// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as vscode from 'vscode';

/**
 * Returns a promise that can be rejected by a cancellation token.
 *
 * This is useful for simulating cancellation for promises that can't be
 * canceled. However, note that a given promise continues to run even if
 * it is canceled.
 */
export function withPseudoCancel<T>(
  body: Promise<T>,
  token: vscode.CancellationToken
): Promise<T> {
  const cancel = new Promise<never>((_resolve, reject) => {
    if (token.isCancellationRequested) {
      reject(new vscode.CancellationError());
      return;
    }
    const subscription = token.onCancellationRequested(() => {
      subscription.dispose();
      reject(new vscode.CancellationError());
    });
  });
  return Promise.race([body, cancel]);
}

/**
 * Similar to fsPromises.stat, but it returns an error as a value, instead of
 * throwing it.
 */
export async function statNoThrow(path: string): Promise<fs.Stats | undefined> {
  try {
    return await fsPromises.stat(path);
  } catch {
    return undefined;
  }
}

/**
 * Watches for inode changes of a file path.
 *
 * It uses a periodic polling to detect changes.
 */
export class FilePathWatcher implements vscode.Disposable {
  private readonly onDidChangeInodeEmitter = new vscode.EventEmitter<
    number | undefined
  >();
  readonly onDidChangeInode = this.onDidChangeInodeEmitter.event;
  private readonly timerHandle: NodeJS.Timeout;
  private lastInode: number | undefined = undefined;

  constructor(private readonly path: string) {
    this.timerHandle = setInterval(() => void this.checkInode(), 1000);
    void this.checkInode();
  }

  dispose(): void {
    this.onDidChangeInodeEmitter.dispose();
    clearInterval(this.timerHandle);
  }

  get inode(): number | undefined {
    return this.lastInode;
  }

  private async checkInode(): Promise<void> {
    const stat = await statNoThrow(this.path);
    const newInode = stat?.ino;
    const oldInode = this.inode;
    this.lastInode = newInode;
    if (newInode !== oldInode) {
      this.onDidChangeInodeEmitter.fire(newInode);
    }
  }
}
