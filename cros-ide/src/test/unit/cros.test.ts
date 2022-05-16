// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as cros from '../../common/cros';
import * as testing from '../testing';

async function prepareBoardsDir(td: string) {
  await testing.putFiles(td, {
    '/build/amd64-generic/x': 'x',
    '/build/betty-pi-arc/x': 'x',
    '/build/bin/x': 'x',
    '/build/coral/x': 'x',
  });

  await fs.promises.utimes(
    path.join(td, '/build/amd64-generic'),
    2 /* timestamp */,
    2
  );
  await fs.promises.utimes(path.join(td, '/build/betty-pi-arc'), 1, 1);
  await fs.promises.utimes(path.join(td, '/build/coral'), 3, 3);
}

describe('Boards that are set up', () => {
  const tempDir = testing.tempDir();

  it('are listed most recent first', async () => {
    await prepareBoardsDir(tempDir.path);

    assert.deepStrictEqual(await cros.getSetupBoardsRecentFirst(tempDir.path), [
      'coral',
      'amd64-generic',
      'betty-pi-arc',
    ]);
  });

  it('are listed in alphabetic order', async () => {
    await prepareBoardsDir(tempDir.path);

    assert.deepStrictEqual(await cros.getSetupBoardsAlphabetic(tempDir.path), [
      'amd64-generic',
      'betty-pi-arc',
      'coral',
    ]);
  });

  it('can be listed, even if /build does not exist', async () => {
    assert.deepStrictEqual(
      await cros.getSetupBoardsAlphabetic(tempDir.path),
      []
    );
  });
});
