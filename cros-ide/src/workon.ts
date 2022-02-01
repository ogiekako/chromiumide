// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as childProcess from 'child_process';
import * as vscode from 'vscode';

// Provides commands to run cros_workon start/stop from the IDE.
export function activate(context: vscode.ExtensionContext) {
  const startCmd = vscode.commands.registerCommand(
      'cros-ide.crosWorkonStart',
      crosWorkon('start'));

  const stopCmd = vscode.commands.registerCommand(
      'cros-ide.crosWorkonStop',
      crosWorkon('stop'));

  context.subscriptions.push(startCmd, stopCmd);
}

function crosWorkon(cmd: string) {
  return async function crosWorkonStart(board?: string, pkg?: string) {
    // When the command if called from the command pallete, board and pkg
    // are not provided and we will prompt the user.

    if (!board) {
      board = await vscode.window.showInputBox({
        title: 'Board',
        placeHolder: 'board, e.g. betty',
      });
      if (!board) {
        return;
      }
    }

    if (!pkg) {
      pkg = await vscode.window.showInputBox({
        title: 'Package',
        placeHolder: 'package, e.g. chromeos-base/shill',
      });
      if (!pkg) {
        return;
      }
    }

    // TODO: Should we refresh 'boards and packages' view?
    childProcess.exec(
        `cros workon --board=${board} ${cmd} ${pkg}`,
        (error, stdout, stderr) => {
          if (error) {
            vscode.window.showInformationMessage(stderr);
          }
        },
    );
  };
}
