// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {EbuildLspClient} from '../../../../features/chromiumos/ebuild/lsp_client';
import * as testing from '../../../testing';
import {closeDocument} from '../../extension_testing';

describe('Ebuild LSP', () => {
  let ebuildLspClient: EbuildLspClient = {} as EbuildLspClient;

  beforeAll(async () => {
    ebuildLspClient = new EbuildLspClient(testing.getExtensionUri());
    await ebuildLspClient.start();
  });

  afterAll(async () => {
    await ebuildLspClient.disposeAsync();
  });

  it('should support hover', async () => {
    const codelab = await vscode.workspace.openTextDocument(
      testing.testdataUri('ebuild_lsp/codelab.ebuild')
    );

    const hover: vscode.Hover[] = await vscode.commands.executeCommand(
      'vscode.executeHoverProvider',
      codelab.uri,
      new vscode.Position(0, 0)
    );

    expect((hover[0].contents[0] as vscode.MarkdownString).value).toEqual(
      'Hello'
    );

    await closeDocument(codelab);
  });
});
