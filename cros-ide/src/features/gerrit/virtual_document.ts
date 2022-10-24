// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as path from 'path';

const SCHEME = 'gerrit';

/**
 * Creates a URI to a document for attaching Gerrit patchset level comments.
 * The document contains fixed text, but `dir` is required,
 * because VSCode shows it in tooltips in the comments UI.
 */
export function patchSetUri(dir: string) {
  return vscode.Uri.from({
    scheme: SCHEME,
    path: path.join(dir, 'PATCHSET_LEVEL'),
  });
}

/** Virtual document for attaching Gerrit patchset level comments. */
export class GerritDocumentProvider
  implements vscode.TextDocumentContentProvider
{
  activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(SCHEME, this)
    );
  }

  async provideTextDocumentContent(_uri: vscode.Uri): Promise<string> {
    return 'This virtual document exists solely to show patchset level comments.';
  }
}
