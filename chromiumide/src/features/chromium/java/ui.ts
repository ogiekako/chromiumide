// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {COMMAND_SHOW_LOGS} from './commands';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly tasks: string[] = [];
  private active = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      0
    );
    this.item.command = COMMAND_SHOW_LOGS;
    this.updateText();
  }

  dispose(): void {
    this.item.dispose();
  }

  show(): void {
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  async withProgress<T>(message: string, body: () => Promise<T>): Promise<T> {
    this.tasks.push(message);
    this.updateText();
    try {
      return await body();
    } finally {
      this.tasks.splice(this.tasks.lastIndexOf(message), 1);
      this.updateText();
    }
  }

  private updateText(): void {
    if (this.tasks.length === 0) {
      this.item.text = 'Chromium Java';
    } else {
      const message = this.tasks[this.tasks.length - 1];
      this.item.text = `$(loading~spin) Chromium Java: ${message}`;
    }
  }
}
