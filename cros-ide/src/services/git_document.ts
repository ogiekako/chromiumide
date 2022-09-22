// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as path from 'path';
import * as commonUtil from '../common/common_util';

export const GIT_MSG_SCHEME = 'gitmsg';

export class GitDocumentProvider implements vscode.TextDocumentContentProvider {
  cache = new Map<string, string>();

  activate() {
    vscode.workspace.registerTextDocumentContentProvider(GIT_MSG_SCHEME, this);
  }

  async getCommitMessage(fsPath: string, sha: string): Promise<string> {
    let message = this.cache.get(sha);

    if (message) {
      return message;
    }

    const dir = path.dirname(fsPath);
    const result = await commonUtil.exec(
      'git',
      ['log', '--format=%B', '-n', '1', sha],
      {
        cwd: dir,
      }
    );

    message =
      result instanceof Error ? `Error occured: ${result}` : result.stdout;
    this.cache.set(sha, message);

    return message;
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return this.getCommitMessage(uri.path, uri.query);
  }
}
