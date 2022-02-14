// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Common utilities between extension code and tools such as installtion
 * script. This file should not depend on 'vscode'.
 */

import * as fs from 'fs';

export function isInsideChroot(): boolean {
  return fs.existsSync('/etc/cros_chroot_version');
}

class Task<T> {
  constructor(readonly job: () => Promise<T>,
    readonly resolve: (x: T | null) => void,
    readonly reject: (reason?: any) => void) {
  }
  cancel() {
    this.resolve(null);
  }
  async run() {
    try {
      this.resolve(await this.job());
    } catch (e) {
      this.reject(e);
    }
  }
}

// JobManager manages jobs and ensures that only one job is run at a time.
// If multiple jobs are in queue waiting for a running job, the manager
// cancels all but the last job.
export class JobManager<T> {
  // Queued tasks.
  private tasks: Task<T>[] = [];
  // True iff the a task is running.
  private running = false;

  constructor() { }

  // Pushes a job and returns a promise that is fulfilled after the job is
  // cancalled or completed. If the job is cancelled, the returned promise is
  // resolved with null.
  offer(job: () => Promise<T>): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.tasks.push(new Task(job, resolve, reject));
      this.handle();
    });
  }

  private async handle(): Promise<void> {
    while (this.tasks.length > 1) {
      this.tasks.shift()!.cancel(); // cancel old tasks
    }
    if (this.running) {
      return;
    }
    const task = this.tasks.pop();
    if (!task) {
      return;
    }

    this.running = true;
    await task.run();
    this.running = false;
    await this.handle(); // handle possible new task
  }
}
