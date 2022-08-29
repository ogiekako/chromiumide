// Copyright 2022 The ChromiumOS Authors.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as ideUtil from '../ide_util';

/**
 * Manages two UI elements showing task status: `StatusBarItem`, which is created here,
 * and `cros-ide-status` view, which is defined in `package.json`.
 *
 * @returns `StatusManager` which allows other packages to create tasks with a status.
 */
export function activate(context: vscode.ExtensionContext): StatusManager {
  context.subscriptions.push(
    vscode.commands.registerCommand('cros-ide.showIdeLog', () => {
      ideUtil.getUiLogger().show();
    })
  );

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  statusBarItem.command = 'cros-ide-status.focus';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const statusManager = new StatusManagerImpl();

  const statusBarHandler = new StatusBarHandler(statusBarItem);
  statusManager.onChange(statusBarHandler.refresh.bind(statusBarHandler));

  const statusTreeData = new StatusTreeData();
  statusManager.onChange(statusTreeData.refresh.bind(statusTreeData));
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('cros-ide-status', statusTreeData)
  );

  return statusManager;
}

export enum TaskStatus {
  OK,
  ERROR,
  RUNNING,
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

export type TaskName = string;

export interface TaskData {
  status: TaskStatus;

  /**
   * Command to be executed when the task is clicked in the UI. It can, for instance,
   * open a UI panel with logs.
   */
  command?: vscode.Command;
}

/**
 * Reports the status of background tasks indicating if the IDE works well or not.
 * It is meant for continuously running background tasks, which should not overuse popups.
 *
 * The status is shown in an abbreviated for in the status bar. Clicking on the status bar item
 * takes the user to a longer view, with a detailed view of all available tasks.
 *
 * Tasks are identified by a human-readable `TaskName`, which is display in various UI locations.
 */
export interface StatusManager {
  setTask(taskName: TaskName, taskData: TaskData): void;
  deleteTask(taskName: TaskName): void;
}

type ChangeHandler = (arg: StatusManagerImpl) => void;

class StatusManagerImpl implements StatusManager {
  private tasks = new Map<TaskName, TaskData>();
  private handlers: ChangeHandler[] = [];

  setTask(taskName: TaskName, taskData: TaskData) {
    this.tasks.set(taskName, taskData);
    this.handleChange();
  }

  deleteTask(taskName: TaskName) {
    this.tasks.delete(taskName);
    this.handleChange();
  }

  getTasks(): TaskName[] {
    return Array.from(this.tasks.keys());
  }

  getTaskData(taskName: TaskName): TaskData | undefined {
    return this.tasks.get(taskName);
  }

  private get(status: TaskStatus): TaskName[] {
    const taskNames = [];
    for (const [id, data] of this.tasks) {
      if (data.status === status) {
        taskNames.push(id);
      }
    }
    return taskNames;
  }

  getErrorTasks(): TaskName[] {
    return this.get(TaskStatus.ERROR);
  }

  getRunningTasks(): TaskName[] {
    return this.get(TaskStatus.RUNNING);
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
    let background: vscode.ThemeColor | undefined;
    let tooltip: string | undefined;

    const errorTasks = statusManagerImpl.getErrorTasks();
    if (errorTasks.length) {
      icon = `$(${getIcon(TaskStatus.ERROR)})`;
      background = new vscode.ThemeColor('statusBarItem.errorBackground');
      tooltip = `Errors: ${errorTasks.sort().join(', ')}`;
    } else {
      icon = `$(${getIcon(TaskStatus.OK)})`;
      background = undefined;
      tooltip = 'No Problems';
    }
    this.statusBarItem.backgroundColor = background;

    const runningTasks = statusManagerImpl.getRunningTasks();
    if (runningTasks.length) {
      icon = `$(${getIcon(TaskStatus.RUNNING)})`;
      tooltip = `Running ${runningTasks.sort().join(', ')}`;
    }
    this.statusBarItem.text = `${icon} CrOS IDE`;
    this.statusBarItem.tooltip = tooltip;
  }
}

class StatusTreeData implements vscode.TreeDataProvider<TaskName> {
  private statusManagerImpl?: StatusManagerImpl;

  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    TaskName | undefined | null | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: TaskName): vscode.TreeItem | Thenable<vscode.TreeItem> {
    const statusManagerImp = this.statusManagerImpl!;
    const taskData = statusManagerImp.getTaskData(element)!;
    return new TaskTreeItem(element, taskData.status, taskData.command);
  }

  getChildren(_element?: TaskName): vscode.ProviderResult<TaskName[]> {
    return this.statusManagerImpl!.getTasks();
  }

  refresh(statusManagerImpl: StatusManagerImpl): void {
    this.statusManagerImpl = statusManagerImpl;
    this.onDidChangeTreeDataEmitter.fire();
  }
}

class TaskTreeItem extends vscode.TreeItem {
  constructor(
    readonly title: string,
    status: TaskStatus,
    command?: vscode.Command
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(getIcon(status));
    this.command = command;
  }
}

export const TEST_ONLY = {
  StatusManagerImpl,
  StatusBarHandler,
  StatusTreeData,
};
