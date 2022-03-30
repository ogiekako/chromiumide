// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as ideUtilities from './ide_utilities';

/**
 * Creates a status bar item showing if the IDE works well or not.
 * It is meant for continuously running background tasks, which should not
 * display popups. Clicking on the status bar item takes the user to
 * the log of background tasks (emerge, and so on).
 */
export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand('cros-ide.showIdeLog', () => {
    ideUtilities.getLogger().show();
  });
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBarItem.command = 'cros-ide.showIdeLog';
  statusBarItem.text = 'CrOS IDE';
  statusBarItem.tooltip = 'Background Tasks';
  statusBarItem.show();

  // TODO(ttylenda): Change color and text (add icon) when errors occur.
}
