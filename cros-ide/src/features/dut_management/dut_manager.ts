// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * This contains the GUI and functionality for managing DUTs
 */
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as ideUtil from '../../ide_util';

export async function activateDutManager(context: vscode.ExtensionContext) {
  rsaKeyFixPermission(context);
}

/**
 * Ensures that test_rsa key perms are 0600, otherwise cannot be used for ssh
 */
async function rsaKeyFixPermission(context: vscode.ExtensionContext) {
  const rsaKeyPath = ideUtil.getTestingRsaPath(context);
  await fs.promises.chmod(rsaKeyPath, '0600').catch(_err => {
    vscode.window.showErrorMessage(
      'Fatal: unable to update testing_rsa permission: ' + rsaKeyPath
    );
  });
}
