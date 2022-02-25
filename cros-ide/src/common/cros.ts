// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as commonUtil from './common_util';

/**
 * @returns Boards that have been set up.
 */
export async function getSetupBoards(): Promise<string[]> {
  const dirs = await fs.promises.readdir('/build');
  return dirs.filter(dir => dir !== 'bin');
}

/**
 * @returns Packages that are worked on.
 */
export async function getWorkedOnPackages(board: string): Promise<string[]> {
  const stdout = await commonUtil.exec(
      'cros_workon', ['--board', board, 'list']);
  return stdout.split('\n').filter(x => x.trim() !== '');
}
