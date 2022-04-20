// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as assert from 'assert';
import * as vscode from 'vscode';
import {installVscodeDouble} from './doubles';

describe('VSCode test doubles', () => {
  installVscodeDouble();

  it('can activate CrOS IDE', async () => {
    const ext = vscode.extensions.getExtension('google.cros-ide');
    assert.ok(ext);
    await ext.activate();
  });
});
