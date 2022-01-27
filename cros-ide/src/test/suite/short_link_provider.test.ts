// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as vscode from 'vscode';

import * as shortLinkProvider from '../../short_link_provider';

const fakeCancellationToken = new class implements vscode.CancellationToken {
  isCancellationRequested!: boolean;
  onCancellationRequested!: vscode.Event<any>;
};

// Create vscode.TextDocument from text and run ShortLinkProvider on it.
async function getLinks(text: string) {
  const document = await vscode.workspace.openTextDocument({'content': text});
  const provider = new shortLinkProvider.ShortLinkProvider();
  return provider.provideDocumentLinks(document, fakeCancellationToken);
}

suite('Short Link Provider Test Suite', () => {
  test('One Buganizer link', async () => {
    const links = await getLinks('Duplicate of b/123456.');
    assert.ok(links);
    assert.strictEqual(links.length, 1);
    const link = links[0];
    assert.deepStrictEqual(link.target, vscode.Uri.parse('http://b/123456'));
    const expectedRange = new vscode.Range(
        new vscode.Position(0, 13),
        new vscode.Position(0, 21),
    );
    assert.deepStrictEqual(link.range, expectedRange);
  });

  test('Two links', async () => {
    const links = await getLinks('We created b/123456 for the crash.\n' +
      'Migrated from crbug/987654 because Monorail is deprecated.');

    assert.ok(links);
    assert.strictEqual(links.length, 2);
    const [b, crbug] = links;

    assert.deepStrictEqual(b.target, vscode.Uri.parse('http://b/123456'));
    const expectedBRange = new vscode.Range(
        new vscode.Position(0, 11),
        new vscode.Position(0, 19),
    );
    assert.deepStrictEqual(b.range, expectedBRange);

    assert.deepStrictEqual(
        crbug.target, vscode.Uri.parse('http://crbug/987654'));
    const expectedCrbugRange = new vscode.Range(
        new vscode.Position(1, 14),
        new vscode.Position(1, 26),
    );
    assert.deepStrictEqual(crbug.range, expectedCrbugRange);
  });
});
