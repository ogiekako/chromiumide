// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';
import {LanguageServerManager} from '../../../../../features/chromium/java/language';
import {StatusBar} from '../../../../../features/chromium/java/ui';
import * as testing from '../../../../testing';
import {
  ConsoleOutputChannel,
  VoidOutputChannel,
} from '../../../../testing/fakes';

// Set to true to redirect the output channel to the console and enable tracing
// the language server protocol.
const VERBOSE_LOGGING = false;

describe('Chromium Java language server', () => {
  const subscriptions: vscode.Disposable[] = [];

  afterEach(() => {
    for (const subscription of subscriptions.splice(0)) {
      subscription.dispose();
    }
  });

  it('publishes diagnostics', async () => {
    if (VERBOSE_LOGGING) {
      // eslint-disable-next-line no-restricted-syntax
      await vscode.workspace
        .getConfiguration('chromiumide.chromium.java')
        .update('trace.server', 'verbose');
    }

    const extensionDir = testing.getExtensionUri().fsPath;
    const srcDir = testing.testdataUri('java/src').fsPath;
    const statusBar = new StatusBar();
    subscriptions.push(statusBar);

    const manager = new LanguageServerManager(
      extensionDir,
      srcDir,
      VERBOSE_LOGGING ? new ConsoleOutputChannel() : new VoidOutputChannel(),
      statusBar,
      true /* skipCertCheck */
    );
    subscriptions.push(manager);

    const onDidChangeDiagnosticsReader = new testing.EventReader(
      vscode.languages.onDidChangeDiagnostics
    );
    subscriptions.push(onDidChangeDiagnosticsReader);

    // Open a Java doc to start a session.
    const sourceUri = vscode.Uri.file(
      path.join(srcDir, 'chrome/java/org/chromium/chrome/Browser.java')
    );
    await vscode.workspace.openTextDocument(sourceUri);

    // Wait for the diagnostics to be published.
    for (;;) {
      const {uris} = await onDidChangeDiagnosticsReader.read();
      if (uris.some(uri => uri.toString() === sourceUri.toString())) {
        break;
      }
    }

    const diagnostics = vscode.languages.getDiagnostics(sourceUri);

    // The deprecated method should be reported. Note that it might not be the only diagnostic
    // because of other features of ChromiumIDE.
    expect(
      diagnostics.some(
        diagnostic =>
          diagnostic.code === 'compiler.warn.has.been.deprecated' &&
          diagnostic.range.start.line === 9
      )
    ).toBeTrue();

    // Set a longer timeout as this test may take some time to launch a Java debug server.
  }, 15000);
});
