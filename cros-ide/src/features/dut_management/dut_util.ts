// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as metrics from '../../features/metrics/metrics';

export function getTestingRsaPath(context: vscode.ExtensionContext): string {
  return vscode.Uri.joinPath(context.extensionUri, 'resources', 'testing_rsa')
    .fsPath;
}

export function createTerminalForHost(
  host: string,
  namePrefix: string,
  context: vscode.ExtensionContext,
  extraOptions?: string
): vscode.Terminal {
  const terminal = vscode.window.createTerminal(`${namePrefix} ${host}`);

  terminal.sendText(
    'ssh '.concat(
      sshFormatArgs(
        host,
        '; exit $?',
        getTestingRsaPath(context),
        extraOptions
      ).join(' ')
    )
  );
  metrics.send({category: 'ideUtil', action: 'create terminal for host'});
  return terminal;
}

/**
 *
 * @param host hostname, which can be in the format of 'hostname' or 'hostname:port'
 * @param cmd CLI command to execute
 * @param testingRsaPath absolute path to the testingRSA key
 * @param extraOptions additional CLI options for your command
 * @returns formatted SSH command
 */
export function sshFormatArgs(
  host: string,
  cmd: string,
  testingRsaPath: string,
  extraOptions?: string
): string[] {
  let port = '22';
  const [hostname, portname] = host.split(':');
  if (portname !== undefined) {
    host = hostname;
    port = portname;
  }

  let args = ['-i', testingRsaPath];
  const trailingArgs = [
    '-o StrictHostKeyChecking=no',
    '-o UserKnownHostsFile=/dev/null',
    '-p',
    port,
    `root@${host}`,
    cmd,
  ];
  if (extraOptions !== undefined) {
    args.push(extraOptions);
  }
  args = args.concat(trailingArgs);
  return args;
}
