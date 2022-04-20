// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as path from 'path';
import * as commonUtil from '../../../common/common_util';
import {Packages} from '../../../features/cpp_code_completion/packages';
import * as testing from '../../testing';

describe('Packages', () => {
  it('returns package information', async () => {
    await commonUtil.withTempDir(async td => {
      const packages = new Packages(path.join(td, '/mnt/host/source'));
      // A file should exists in the filepath to get its absolute path.
      await testing.putFiles(td, {
        '/mnt/host/source/src/platform2/cros-disks/foo.cc': 'x',
        '/mnt/host/source/src/platform2/unknown_dir/foo.cc': 'x',
      });

      assert.deepStrictEqual(
        await packages.fromFilepath(
          path.join(td, '/mnt/host/source/src/platform2/cros-disks/foo.cc')
        ),
        {
          sourceDir: 'src/platform2/cros-disks',
          atom: 'chromeos-base/cros-disks',
        },
        'success'
      );

      assert.deepStrictEqual(
        await packages.fromFilepath(
          path.join(td, '/mnt/host/source/src/platform2/unknown_dir/foo.cc')
        ),
        null,
        'unknown'
      );

      assert.deepStrictEqual(
        await packages.fromFilepath(
          path.join(td, '/mnt/host/source/not_exist')
        ),
        null,
        'not exist'
      );
    });
  });
});
