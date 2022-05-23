// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as ws from 'ws';
import * as dutUtil from './dut_util';
import * as webviewShared from './webview_shared';

/**
 * Represents a protocol used between the WebView and localhost.
 */
export enum ProxyProtocol {
  WEBSOCKET,
  MESSAGE_PASSING,
}

/**
 * Represents an active VNC session of a DUT.
 *
 * It manages UI resources associated to a VNC session, such as a vscode.Terminal used to start and
 * forward KMSVNC server on the DUT, and a vscode.WebViewPanel to render NoVNC UI on.
 *
 * It also manages a proxy to allow the WebView to connect to the VNC server. There are two kinds
 * of proxies used:
 *
 * - WebSocketProxy: Starts a local WebSocket server that proxies communication between the WebView
 *    client and the VNC server. This proxy is used when the WebView can connect to the localhost,
 *    possibly with port forwarding in the case of remote development.
 * - MessagePassingProxy: Starts a in-process server that implements a socket over the WebView's
 *    message passing mechanism. This proxy is used when the WebView can NOT connect to the
 *    localhost, e.g. when the editor is running within a web browser.
 *
 * The WebView is initially empty. Call start() to start WebView, possibly after subscribing to
 * some events.
 *
 * Call dispose() to destroy the session programmatically. It is also called when the user closes
 * the WebView panel.
 */
export class VncSession {
  private static readonly KMSVNC_PORT = 5900;

  // Tracks the next port number to use for SSH port forwarding.
  // TODO: Think of a better way to find an unused port.
  private static nextAvailablePort = 55900;

  private readonly terminal: vscode.Terminal;
  private readonly panel: vscode.WebviewPanel;
  private readonly proxy: WebSocketProxy | MessagePassingProxy;

  private readonly onDidDisposeEmitter = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.onDidDisposeEmitter.event;

  private readonly onDidReceiveMessageEmitter =
    new vscode.EventEmitter<webviewShared.ClientMessage>();
  readonly onDidReceiveMessage = this.onDidReceiveMessageEmitter.event;

  private readonly subscriptions: vscode.Disposable[] = [
    // onDidDisposeEmitter is not listed here so we can fire it after disposing everything else.
    this.onDidReceiveMessageEmitter,
  ];

  constructor(
    host: string,
    private readonly context: vscode.ExtensionContext,
    proxyProtocol?: ProxyProtocol
  ) {
    const forwardPort = VncSession.nextAvailablePort++;

    this.terminal = VncSession.startVncServer(host, forwardPort, context);
    this.panel = VncSession.createWebview(host);
    switch (proxyProtocol ?? detectProxyProtocol()) {
      case ProxyProtocol.WEBSOCKET:
        this.proxy = new WebSocketProxy(forwardPort);
        break;
      case ProxyProtocol.MESSAGE_PASSING:
        this.proxy = new MessagePassingProxy(forwardPort, this.panel.webview);
        break;
    }
    this.subscriptions.push(this.terminal, this.panel, this.proxy);

    this.subscriptions.push(
      this.panel.webview.onDidReceiveMessage(
        (message: webviewShared.ClientMessage) => {
          this.onDidReceiveMessageEmitter.fire(message);
        }
      )
    );

    // Dispose the session when the panel is closed.
    this.subscriptions.push(
      this.panel.onDidDispose(() => {
        this.dispose();
      })
    );
  }

  start(): void {
    VncSession.startWebview(this.panel.webview, this.proxy, this.context);
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
    this.onDidDisposeEmitter.fire();
    this.onDidDisposeEmitter.dispose();
  }

  revealPanel(): void {
    this.panel.reveal();
  }

  private static startVncServer(
    host: string,
    forwardPort: number,
    context: vscode.ExtensionContext
  ): vscode.Terminal {
    const terminal = dutUtil.createTerminalForHost(
      host,
      'CrOS: VNC Server',
      context,
      ['-L', `${forwardPort}:localhost:${VncSession.KMSVNC_PORT}`]
    );
    // Stop an existing server if any.
    terminal.sendText(`fuser -k ${VncSession.KMSVNC_PORT}/tcp; kmsvnc`);
    return terminal;
  }

  private static createWebview(host: string): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
      'vncclient',
      `VNC: ${host}`,
      vscode.ViewColumn.One,
      {
        // Scripting is needed to run NoVNC.
        enableScripts: true,
        // Retain the content even if the tab is not visible.
        // https://code.visualstudio.com/api/extension-guides/webview#retaincontextwhenhidden
        retainContextWhenHidden: true,
      }
    );
  }

  private static async startWebview(
    webview: vscode.Webview,
    proxy: WebSocketProxy | MessagePassingProxy,
    context: vscode.ExtensionContext
  ): Promise<void> {
    let proxyUrl: string;
    if (proxy instanceof MessagePassingProxy) {
      proxyUrl = webviewShared.MESSAGE_PASSING_URL;
    } else {
      // Call asExternalUri with http:// URL to set up port forwarding
      // in the case of remote development.
      // https://code.visualstudio.com/api/advanced-topics/remote-extensions#option-1-use-asexternaluri
      const proxyHttpUrl = await vscode.env.asExternalUri(
        vscode.Uri.parse(`http://localhost:${proxy.listenPort}/`)
      );
      proxyUrl = proxyHttpUrl.with({scheme: 'ws'}).toString();
    }
    webview.html = VncSession.getWebviewContent(webview, proxyUrl, context);
  }

  private static getWebviewContent(
    webview: vscode.Webview,
    proxyUrl: string,
    context: vscode.ExtensionContext
  ): string {
    const filePath = path.join(context.extensionPath, 'dist/views/vnc.html');
    const html = fs.readFileSync(filePath, {encoding: 'utf-8'});
    return replaceAll(html, [
      {
        from: /%EXTENSION_ROOT_URL%/g,
        to: webview.asWebviewUri(context.extensionUri).toString(),
      },
      {from: /%WEB_SOCKET_PROXY_URL%/g, to: proxyUrl},
    ]);
  }
}

// Represents a local WebSocket server which acts as a protocol proxy between the NoVNC client
// and the KMSVNC server.
// Specify a VNC server port on localhost to construct.
// It listens on an arbitrary unused TCP port on localhost. Read listenPort property to obtain
// the port number actually allocated.
class WebSocketProxy implements vscode.Disposable {
  private readonly server: ws.WebSocketServer;

  constructor(vncPort: number) {
    this.server = new ws.WebSocketServer({port: 0});
    this.server.on('connection', (downstream: ws.WebSocket) => {
      downstream.binaryType = 'nodebuffer';
      const upstream = net.createConnection(vncPort, 'localhost');

      upstream.on('error', (err: Error) => {
        console.error(err);
      });
      upstream.on('close', () => {
        downstream.close();
      });
      downstream.on('error', (err: Error) => {
        console.error(err);
      });
      downstream.on('close', () => {
        upstream.destroy();
      });

      upstream.on('connect', () => {
        upstream.on('data', (data: Buffer) => {
          downstream.send(data);
        });
        downstream.on('message', (data: Buffer) => {
          upstream.write(data);
        });
      });
    });
  }

  dispose(): void {
    this.server.close();
  }

  get listenPort(): number {
    return (this.server.address() as ws.AddressInfo).port;
  }
}

// Handles socket operations implemented over VSCode WebView's message passing mechanism.
// Specify a VNC server port on localhost to construct.
class MessagePassingProxy implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly sockets = new Map<number, net.Socket>();

  constructor(
    private readonly vncPort: number,
    private readonly webview: vscode.Webview
  ) {
    this.subscriptions.push(
      webview.onDidReceiveMessage((message: webviewShared.ClientMessage) =>
        this.onMessage(message)
      )
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions).dispose();
    for (const socket of this.sockets.values()) {
      socket.destroy();
    }
    this.sockets.clear();
  }

  private onMessage(message: webviewShared.ClientMessage): void {
    if (message.type !== 'socket') {
      return;
    }

    const {subtype, socketId} = message;
    switch (subtype) {
      case 'open': {
        const socket = net.createConnection(this.vncPort, 'localhost');
        this.sockets.set(socketId, socket);
        socket.on('connect', () => {
          postServerMessage(this.webview, {
            type: 'socket',
            subtype: 'open',
            socketId,
          });
        });
        socket.on('error', (err: Error) => {
          postServerMessage(this.webview, {
            type: 'socket',
            subtype: 'error',
            socketId,
            reason: err.message,
          });
        });
        socket.on('data', (data: Buffer) => {
          postServerMessage(this.webview, {
            type: 'socket',
            subtype: 'data',
            socketId,
            data: data.toString('base64'),
          });
        });
        socket.on('close', () => {
          postServerMessage(this.webview, {
            type: 'socket',
            subtype: 'close',
            socketId,
          });
        });
        break;
      }

      case 'close': {
        const socket = this.sockets.get(socketId);
        if (!socket) {
          break;
        }
        socket.destroy();
        this.sockets.delete(socketId);
        break;
      }

      case 'data': {
        const socket = this.sockets.get(socketId);
        if (!socket) {
          break;
        }
        socket.write(Buffer.from(message.data, 'base64'));
        break;
      }
    }
  }
}

interface ReplacePattern {
  from: RegExp;
  to: string;
}

function replaceAll(s: string, patterns: ReplacePattern[]): string {
  for (const pattern of patterns) {
    s = s.replace(pattern.from, pattern.to);
  }
  return s;
}

// Type-safe wrapper of vscode.Webview.postMessage.
async function postServerMessage(
  webview: vscode.Webview,
  message: webviewShared.ServerMessage
): Promise<void> {
  await webview.postMessage(message);
}

function detectProxyProtocol(): ProxyProtocol {
  // Prefer WebSocket protocol as it's more efficient.
  if (vscode.env.appHost === 'desktop') {
    return ProxyProtocol.WEBSOCKET;
  }
  // In other cases, fall back to the message passing protocol.
  return ProxyProtocol.MESSAGE_PASSING;
}
