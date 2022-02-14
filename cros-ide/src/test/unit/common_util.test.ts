// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as commonUtil from '../../common/common_util';

class BlockingPromise {
  readonly promise: Promise<void>;
  unblock: () => void;
  private constructor(created: (p: BlockingPromise) => void) {
    this.unblock = () => { }; // placeholder to satisfy type system.
    this.promise = new Promise(resolve => {
      this.unblock = resolve;
      created(this);
    });
  }
  static async new(): Promise<BlockingPromise> {
    return new Promise(resolve => {
      return new BlockingPromise(resolve);
    });
  }
}

suite('Job manager', () => {
  test('Jobs are throttled', async () => {
    const manager = new commonUtil.JobManager();

    const guard = await BlockingPromise.new();

    const p1 = manager.offer(async () => {
      await guard.promise;
      return true;
    });

    await new Promise(resolve => setTimeout(resolve, 0)); // tick to run p1

    const p2 = manager.offer(async () => {
      assert.fail('Intermediate job should not run');
    });

    let p3Run = false;
    const p3 = manager.offer(async () => {
      // The last-offered job should be queued.
      p3Run = true;
    });

    // Cancelled job should return immediately.
    assert.strictEqual(await p2, null);

    assert.strictEqual(p3Run, false); // p3 should not run while p1 is running

    guard.unblock();

    assert.strictEqual(await p1, true);
    await p3;

    assert.strictEqual(p3Run, true);
  });
  test('Errors', async () => {
    const manager = new commonUtil.JobManager();

    const guard = await BlockingPromise.new();

    const p1 = manager.offer(async () => {
      await guard.promise;
      throw new Error('p1');
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    const p2 = manager.offer(async () => {
      assert.fail('Intermediate job should not run');
    });
    const p3 = manager.offer(async () => {
      throw new Error('p3');
    });

    await p2;

    guard.unblock();
    await assert.rejects(p1);
    await assert.rejects(p3);
  });
});
