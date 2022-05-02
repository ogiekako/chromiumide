// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as ideUtil from '../ide_util';

export async function activate(context: vscode.ExtensionContext) {
  const recommendations: Recommendation[] = [
    {
      languageId: 'cpp',
      extensionId: 'llvm-vs-code-extensions.vscode-clangd',
      message:
        'Clangd extension provides cross references and autocompletion in C++. ' +
        'Would you like to install it?',
      availableForCodeServer: true,
    },
    {
      languageId: 'gn',
      extensionId: 'msedge-dev.gnls',
      message:
        'GN Language Server extension provides syntax highlighting and code navigation for GN build files. ' +
        'Would you like to install it?',
      availableForCodeServer: false,
    },
    {
      languageId: 'go',
      extensionId: 'golang.Go',
      message:
        'Go extension provides rich language support for the Go programming language. ' +
        'Would you like to install it?',
      availableForCodeServer: true,
    },
  ];

  const isCodeServer = ideUtil.isCodeServer();
  for (const recommended of recommendations) {
    const disposable = await activateSingle(recommended, isCodeServer);
    if (disposable === undefined) {
      continue;
    }
    context.subscriptions.push(disposable);
  }
}

export interface Recommendation {
  languageId: string;
  extensionId: string;
  message: string;

  // Whether the recommended extension is available for both the regular VS Code and
  // code-server. It is assumed that the former is a superset of the latter.
  availableForCodeServer: boolean;
}

/**
 * Registers a recommendation if the recommended extension is not installed.
 *
 * @returns Disposable which should be called on deactivation, or undefined if
 * the extension is already installed.
 */
export async function activateSingle(
  recommended: Recommendation,
  isCodeServer: boolean
): Promise<vscode.Disposable | undefined> {
  // Don't install handler if the extension is already installed.
  if (vscode.extensions.getExtension(recommended.extensionId)) {
    return undefined;
  }

  await suggestOnMatch(
    recommended,
    isCodeServer,
    vscode.window.activeTextEditor
  );

  const subscription: vscode.Disposable[] = [];

  return vscode.window.onDidChangeActiveTextEditor(
    async editor => {
      if (await suggestOnMatch(recommended, isCodeServer, editor)) {
        subscription[0].dispose();
      }
    },
    undefined,
    subscription
  );
}

async function suggestOnMatch(
  recommended: Recommendation,
  isCodeServer: boolean,
  editor?: vscode.TextEditor
): Promise<boolean> {
  if (!editor) {
    return false;
  }
  if (editor.document.languageId !== recommended.languageId) {
    return false;
  }
  if (!recommended.availableForCodeServer && isCodeServer) {
    return false;
  }

  return await suggest(recommended);
}

const YES = 'Yes';
const LATER = 'Later';

// Returns true if suggestion is no longer needed.
async function suggest(recommended: Recommendation): Promise<boolean> {
  if (vscode.extensions.getExtension(recommended.extensionId)) {
    return true;
  }
  const choice = await vscode.window.showInformationMessage(
    recommended.message,
    YES,
    LATER
  );
  if (choice === YES) {
    await vscode.commands.executeCommand(
      'extension.open',
      recommended.extensionId
    );
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      recommended.extensionId
    );
  } else if (choice === LATER) {
    return true;
  }
  return false;
}
