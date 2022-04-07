// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as vscode from 'vscode';

describe('CrOS IDE', () => {
  /**
   * The test will fail if activating the extension is not possible,
   * for example, if the main function, extension.activate(), throws an Error.
   */
  it('activates without errors', async () => {
    const ext = vscode.extensions.getExtension('google.cros-ide');
    assert.ok(ext);
    await ext.activate();
  });
});
