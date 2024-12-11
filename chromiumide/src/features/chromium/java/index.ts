// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {
  StatusManager,
  TaskStatus,
} from '../../../../shared/app/ui/bg_task_status';
import {registerCommands} from './commands';
import {StatusBar} from './ui';

export async function activate(
  context: vscode.ExtensionContext,
  _chromiumDir: string,
  statusManager: StatusManager
): Promise<void> {
  const output = vscode.window.createOutputChannel(
    'ChromiumIDE: Chromium Java support'
  );

  // Register the output channel to the IDE status view.
  statusManager.setTask('Chromium Java support', {
    status: TaskStatus.OK,
    outputChannel: output,
  });

  registerCommands(context, output);

  const statusBar = new StatusBar();
  // For now, unconditionally show the status bar to ensure it's working.
  statusBar.show();
}
