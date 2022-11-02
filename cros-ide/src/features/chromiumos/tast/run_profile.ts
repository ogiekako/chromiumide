// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

/**
 * Handles requests to run tests.
 */
export class RunProfile implements vscode.Disposable {
  constructor(controller: vscode.TestController) {
    this.subscriptions.push(
      controller.createRunProfile(
        'Tast',
        vscode.TestRunProfileKind.Run,
        this.runHandler.bind(this, controller),
        /* isDefault = */ true
      )
    );
  }

  private readonly subscriptions: vscode.Disposable[] = [];

  dispose() {
    vscode.Disposable.from(...this.subscriptions.reverse()).dispose();
  }

  private async runHandler(
    controller: vscode.TestController,
    request: vscode.TestRunRequest,
    _cancellation: vscode.CancellationToken
  ) {
    const run = controller.createTestRun(request);

    const testItems: vscode.TestItem[] = [];
    if (request.include) {
      request.include.forEach(test => testItems.push(test));
    } else {
      controller.items.forEach(test => testItems.push(test));
    }

    for (const testItem of testItems) {
      run.started(testItem);

      const start = new Date();

      await vscode.commands.executeCommand(
        'cros-ide.deviceManagement.runTastTests'
      );

      const duration = new Date().getMilliseconds() - start.getMilliseconds();

      // TODO(oka): Report failure or cancellation of the test.

      run.passed(testItem, duration);
    }

    run.end();
  }
}
