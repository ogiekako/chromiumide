// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import {Disposable} from 'vscode';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  NodeModule,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

export class EbuildLspClient implements Disposable {
  private readonly client: LanguageClient;

  /** Instantiates the client, `start` should be called for the feature to start working. */
  constructor(extensionUri: vscode.Uri, outputChannel?: vscode.OutputChannel) {
    const serverModule = path.join(extensionUri.fsPath, 'dist/server.js');

    const nodeModule: NodeModule = {
      module: serverModule,
      args: ['--lsp', 'ebuild'],
      transport: TransportKind.ipc,
    };

    const serverOptions: ServerOptions = {
      run: nodeModule,
      debug: nodeModule,
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        {
          scheme: 'file',
          pattern: '**/*.{ebuild,eclass}',
        },
      ],
      outputChannel,
    };

    this.client = new LanguageClient(
      'ebuildLsp',
      'ChromiumIDE: Ebuild LSP',
      serverOptions,
      clientOptions
    );
  }

  /** Starts the client. This will also launch the server. */
  async start(): Promise<void> {
    try {
      await this.client.start();
    } catch (e) {
      await vscode.window.showErrorMessage(
        `Internal error: ebuild LSP; client.start(): ${e}`
      );
    }
  }

  dispose(): void {
    void this.disposeAsync();
  }

  async disposeAsync(): Promise<void> {
    try {
      await this.client.stop();
    } catch (e) {
      await vscode.window.showErrorMessage(
        `Internal error: ebuild LSP; client.stop(): ${e}`
      );
    }
  }
}
