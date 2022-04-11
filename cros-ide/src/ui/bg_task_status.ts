// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as ideUtilities from '../ide_utilities';

/**
 *  Manages UI showing task status.
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

  const statusBarHandler = new StatusBarHandler(statusBarItem);

  const statusManager = new StatusManagerImpl();
  statusManager.onChange(statusBarHandler.refresh.bind(statusBarHandler));

  return statusManager;
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

function getIcon(ts: TaskStatus): string {
  switch (ts) {
    case TaskStatus.OK:
      return 'check';
    case TaskStatus.ERROR:
      return 'error';
    case TaskStatus.RUNNING:
      return 'sync~spin';
  }
}

export type TaskId = string

/**
 * Reports the status of background tasks indicating if the IDE works well or not.
 * It is meant for continuously running background tasks, which should not overuse popups.
 *
 * The status is shown in an abbreviated for in the status bar.
 */
// TODO(b:228411680): Clicking on the status bar item takes the user to a longer view,
// with a detailed view of all available tasks.
export interface StatusManager {
  setTask(taskId: TaskId, status: TaskStatus): void;
  deleteTask(taskId: TaskId): void;
}

type ChangeHandler = (arg: StatusManagerImpl) => void;

class StatusManagerImpl implements StatusManager {
  private tasks = new Map<TaskId, TaskStatus>();
  private handlers: ChangeHandler[] = [];

  setTask(taskId: TaskId, status: TaskStatus) {
    this.tasks.set(taskId, status);
    this.handleChange();
  }

  deleteTask(taskId: TaskId) {
    this.tasks.delete(taskId);
    this.handleChange();
  }

  private has(status: TaskStatus): boolean {
    for (const s of this.tasks.values()) {
      if (s === status) {
        return true;
      }
    }
    return false;
  }

  hasError(): boolean {
    return this.has(TaskStatus.ERROR);
  }

  hasRunning(): boolean {
    return this.has(TaskStatus.RUNNING);
  }

  onChange(handler: ChangeHandler) {
    this.handlers.push(handler);
    handler(this);
  }

  handleChange() {
    for (const handler of this.handlers) {
      handler(this);
    }
  }
}

class StatusBarHandler {
  constructor(private readonly statusBarItem: vscode.StatusBarItem) {}

  /**
   * Adjusts appearance of the status bar based on status of tasks.
   *
   * The background of the status bar item is determined by the presence of errors
   * or warnings alone.
   *
   * The icon is a spinning circle if some tasks are running. If nothing is running at the moment,
   * then the icon is chosen based on the presence or lack of errors.
   */
  refresh(statusManagerImpl: StatusManagerImpl) {
    let icon: string;
    let background: vscode.ThemeColor|undefined;
    let tooltip: string|undefined;

    if (statusManagerImpl.hasError()) {
      icon = `$(${getIcon(TaskStatus.ERROR)})`;
      background = new vscode.ThemeColor('statusBarItem.errorBackground');
      tooltip = 'Background Tasks (Errors)';
    } else {
      icon = `$(${getIcon(TaskStatus.OK)})`;
      background = undefined;
      tooltip = 'Background Tasks (No Problems)';
    }
    this.statusBarItem.backgroundColor = background;

    if (statusManagerImpl.hasRunning()) {
      icon = `$(${getIcon(TaskStatus.RUNNING)})`;
      tooltip = 'Background Tasks (Running)';
    }
    this.statusBarItem.text = `${icon} CrOS IDE`;
    this.statusBarItem.tooltip = tooltip;
  }
}

export const TEST_ONLY = {
  StatusManagerImpl,
  StatusBarHandler,
};
