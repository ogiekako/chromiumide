// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as bgTaskStatus from '../../ui/bg_task_status';

describe('Status Manager', () => {
  const errorBgColor = new vscode.ThemeColor('statusBarItem.errorBackground');

  function assertShowsError(statusBarItem: vscode.StatusBarItem) {
    assert.deepStrictEqual(statusBarItem.text, '$(error) CrOS IDE');
    assert.deepStrictEqual(statusBarItem.tooltip, 'Background Tasks (Errors)');
    assert.deepStrictEqual(statusBarItem.backgroundColor, errorBgColor);
  }

  function assertShowsOk(statusBarItem: vscode.StatusBarItem) {
    assert.deepStrictEqual(statusBarItem.text, '$(check) CrOS IDE');
    assert.deepStrictEqual(statusBarItem.tooltip, 'Background Tasks (No Problems)');
    assert.deepStrictEqual(statusBarItem.backgroundColor, undefined);
  }

  let statusBarItem: vscode.StatusBarItem;
  let statusManager: bgTaskStatus.StatusManager;

  beforeEach(() => {
    statusBarItem = vscode.window.createStatusBarItem();
    statusBarItem.show();
    statusManager = new bgTaskStatus.StatusManager(statusBarItem);
  });

  afterEach(() => {
    statusBarItem.dispose();
  });

  it('changes status bar item when tasks are added and removed', () => {
    assertShowsOk(statusBarItem);

    statusManager.setTask('error-A', bgTaskStatus.TaskStatus.ERROR);
    statusManager.setTask('error-B', bgTaskStatus.TaskStatus.ERROR);
    assertShowsError(statusBarItem);

    statusManager.deleteTask('error-A');
    assertShowsError(statusBarItem);

    statusManager.deleteTask('error-B');
    assertShowsOk(statusBarItem);
  });

  it('allows deleting tasks without adding them first', () => {
    statusManager.deleteTask('delete-before-adding');
    assertShowsOk(statusBarItem);
  });

  it('shows abbreviated status of tasks (running -> errors -> warnings -> ok)', () => {
    statusManager.setTask('running', bgTaskStatus.TaskStatus.RUNNING);
    statusManager.setTask('ok', bgTaskStatus.TaskStatus.OK);
    statusManager.setTask('error', bgTaskStatus.TaskStatus.ERROR);
    assert.deepStrictEqual(statusBarItem.text, '$(sync~spin) CrOS IDE');
    assert.deepStrictEqual(statusBarItem.backgroundColor, errorBgColor);

    statusManager.deleteTask('running');
    assert.deepStrictEqual(statusBarItem.text, '$(error) CrOS IDE');
    assert.deepStrictEqual(statusBarItem.backgroundColor, errorBgColor);

    statusManager.deleteTask('error');
    assert.deepStrictEqual(statusBarItem.text, '$(check) CrOS IDE');
    assert.deepStrictEqual(statusBarItem.backgroundColor, undefined);

    statusManager.deleteTask('ok');
    assert.deepStrictEqual(statusBarItem.text, '$(check) CrOS IDE');
    assert.deepStrictEqual(statusBarItem.backgroundColor, undefined);
  });
});
