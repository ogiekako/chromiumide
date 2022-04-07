// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as ideUtilities from '../ide_utilities';

/**
 * Manages UI showing task status.
 *
 * @returns `StatusManager` which allows other packages to create tasks with a status.
 */
export function activate(context: vscode.ExtensionContext): StatusManager {
  vscode.commands.registerCommand('cros-ide.showIdeLog', () => {
    ideUtilities.getLogger().show();
  });

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  // TODO(b:228411680): Show new errors view instead.
  statusBarItem.command = 'cros-ide.showIdeLog';
  statusBarItem.show();

  return new StatusManager(statusBarItem);
}

export enum TaskStatus {
  // TODO(b:228543298): eslint incorrectly warns of unused enums.
  // eslint-disable-next-line no-unused-vars
  OK,
  // eslint-disable-next-line no-unused-vars
  ERROR,
  // eslint-disable-next-line no-unused-vars
  RUNNING
}

type TaskId = string

/**
 * Reports the status of background tasks indicating if the IDE works well or not.
 * It is meant for continuously running background tasks, which should not overuse popups.
 *
 * The status is shown in an abbreviated for in the status bar.
 */
// TODO(228411680): Clicking on the status bar item takes the user to a longer view,
// with a detailed view of all available tasks.
export class StatusManager {
  private tasks = new Map<TaskId, TaskStatus>();

  constructor(private readonly statusBarItem: vscode.StatusBarItem) {
    this.refresh();
  }

  setTask(taskId: TaskId, status: TaskStatus) {
    this.tasks.set(taskId, status);
    this.refresh();
  }

  deleteTask(taskId: TaskId) {
    this.tasks.delete(taskId);
    this.refresh();
  }

  /**
   * Adjusts appearance of the status bar based on status of tasks.
   *
   * The background of the status bar item is determined by the presence of errors
   * or warnings alone.
   *
   * The icon is a spinning circle if some tasks are running. If nothing is running at the moment,
   * then the icon is chosen based on the presence or lack of errors.
   */
  private refresh() {
    let icon: string;
    let background: vscode.ThemeColor|undefined;
    let tooltip: string|undefined;

    const statusSet = new Set(this.tasks.values());

    if (statusSet.has(TaskStatus.ERROR)) {
      icon = '$(error)';
      background = new vscode.ThemeColor('statusBarItem.errorBackground');
      tooltip = 'Background Tasks (Errors)';
    } else {
      icon = '$(check)';
      background = undefined;
      tooltip = 'Background Tasks (No Problems)';
    }
    this.statusBarItem.backgroundColor = background;

    if (statusSet.has(TaskStatus.RUNNING)) {
      icon = '$(sync~spin)';
      tooltip = 'Background Tasks (Running)';
    }
    this.statusBarItem.text = `${icon} CrOS IDE`;
    this.statusBarItem.tooltip = tooltip;
  }
}
