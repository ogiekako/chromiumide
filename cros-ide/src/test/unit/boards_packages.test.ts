// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'jasmine';
import * as commonUtil from '../../common/common_util';
import {TEST_ONLY} from '../../features/boards_packages';
import {installVscodeDouble} from '../integration/doubles';
import {exactMatch, FakeExec} from '../testing';

const {Board, Package, crosWorkonStart, crosWorkonStop} = TEST_ONLY;

describe('Boards and Packages view', () => {
  const {vscodeSpy} = installVscodeDouble();

  it('shows a message when starting work on a non existing package', async () => {
    vscodeSpy.window.showInputBox.and.resolveTo('no-such-package');

    const fakeExec = new FakeExec().on(
      'cros_workon',
      exactMatch(['--board=eve', 'start', 'no-such-package'], async () => {
        return {
          stdout: '',
          stderr: 'could not find the package',
          exitStatus: 1,
        };
      })
    );
    const cleanUp = commonUtil.setExecForTesting(fakeExec.exec.bind(fakeExec));

    try {
      const board = new Board('eve');
      await crosWorkonStart(board);
      expect(vscodeSpy.window.showErrorMessage.calls.argsFor(0)).toEqual([
        'cros_workon failed: could not find the package',
      ]);
    } finally {
      cleanUp();
    }
  });

  it('shows a message if cros_workon is not found', async () => {
    const fakeExec = new FakeExec().on(
      'cros_workon',
      exactMatch(['--board=eve', 'stop', 'shill'], async () => {
        return new Error('cros_workon not found');
      })
    );
    const cleanUp = commonUtil.setExecForTesting(fakeExec.exec.bind(fakeExec));

    try {
      const board = new Board('eve');
      const pkg = new Package(board, 'shill');
      await crosWorkonStop(pkg);
      expect(vscodeSpy.window.showErrorMessage.calls.argsFor(0)).toEqual([
        'cros_workon not found',
      ]);
    } finally {
      cleanUp();
    }
  });

  // TODO(ttylenda): test listing boards and packages
});
