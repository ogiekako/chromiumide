// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Chroot, CrosOut} from '../../shared/app/common/common_util';
import {getDriver} from '../../shared/app/common/driver_repository';
import {WrapFs} from '../../shared/app/common/wrap_fs';

export const driver = getDriver();

/**
 * @returns Boards that have been set up, ordered by access time (newest to
 * oldest).
 */
export async function getSetupBoardsRecentFirst(
  chroot: WrapFs<Chroot>,
  out: WrapFs<CrosOut>
): Promise<string[]> {
  return getSetupBoardsOrdered(
    chroot,
    out,
    async (fs, dir) => fs.aTime(dir),
    (a, b) => b - a
  );
}

/**
 * @returns Boards that have been set up in alphabetic order.
 */
export async function getSetupBoardsAlphabetic(
  chroot: WrapFs<Chroot>,
  out: WrapFs<CrosOut>
): Promise<string[]> {
  return getSetupBoardsOrdered(
    chroot,
    out,
    async (_fs, dir) => dir,
    (a, b) => a.localeCompare(b)
  );
}

async function getSetupBoardsOrdered<T>(
  chroot: WrapFs<Chroot>,
  out: WrapFs<CrosOut>,
  keyFn: (fs: WrapFs<Chroot | CrosOut>, dir: string) => Promise<T>,
  compareFn: (a: T, b: T) => number
): Promise<string[]> {
  const res = [];
  for (const fs of [chroot, out]) {
    res.push(...(await getSetupBoardsOrderedInner(fs, keyFn, compareFn)));
  }
  return res;
}

async function getSetupBoardsOrderedInner<T, F extends Chroot | CrosOut>(
  fs: WrapFs<F>,
  keyFn: (fs: WrapFs<F>, dir: string) => Promise<T>,
  compareFn: (a: T, b: T) => number
): Promise<string[]> {
  const build = '/build';

  // /build does not exist outside chroot, which causes problems in tests.
  if (!(await fs.exists(build))) {
    return [];
  }

  const dirs = await fs.readdir(build);
  const dirStat: Array<[string, T]> = [];
  for (const dir of dirs) {
    // README file exists in chroot/build if it's a directory on which out/build
    // is mounted in chroot.
    if (dir === 'bin' || dir === 'README') {
      continue;
    }
    dirStat.push([dir, await keyFn(fs, driver.path.join(build, dir))]);
  }
  dirStat.sort(([, a], [, b]) => compareFn(a, b));
  return dirStat.map(([x]) => x);
}
