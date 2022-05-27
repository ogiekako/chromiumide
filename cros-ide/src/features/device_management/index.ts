// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * This contains the GUI and functionality for managing devices
 */
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as commands from './commands_provider';
import * as repository from './device_repository';
import * as provider from './device_tree_data_provider';
import * as sshUtil from './ssh_util';

export async function activate(context: vscode.ExtensionContext) {
  rsaKeyFixPermission(context.extensionUri);

  const output = vscode.window.createOutputChannel(
    'CrOS IDE: Device Management'
  );
  const ownedDeviceRepository = new repository.OwnedDeviceRepository();
  const leasedDeviceRepository = new repository.LeasedDeviceRepository();
  const commandsProvider = new commands.CommandsProvider(
    context,
    output,
    ownedDeviceRepository,
    leasedDeviceRepository
  );
  const deviceTreeDataProvider = new provider.DeviceTreeDataProvider(
    ownedDeviceRepository,
    leasedDeviceRepository
  );

  context.subscriptions.push(
    ownedDeviceRepository,
    leasedDeviceRepository,
    commandsProvider,
    deviceTreeDataProvider
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('devices', deviceTreeDataProvider)
  );
}

/**
 * Ensures that test_rsa key perms are 0600, otherwise cannot be used for ssh
 */
async function rsaKeyFixPermission(extensionUri: vscode.Uri) {
  const rsaKeyPath = sshUtil.getTestingRsaPath(extensionUri);
  await fs.promises.chmod(rsaKeyPath, '0600').catch(_err => {
    vscode.window.showErrorMessage(
      'Fatal: unable to update testing_rsa permission: ' + rsaKeyPath
    );
  });
}
