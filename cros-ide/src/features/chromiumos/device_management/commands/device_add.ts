// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as os from 'os';
import * as metrics from '../../../metrics/metrics';
import {AddOwnedDeviceService} from '../owned/add_owned_device_service';
import {AddOwnedDeviceViewContext} from '../owned/add_owned_device_model';
import {AddOwnedDevicePanel} from '../owned/add_owned_device_panel';
import * as ssh_config from '../ssh_config';
import {underDevelopment} from './../../../../services/config';
import {CommandContext, promptNewHostname} from './common';

export async function addDevice(context: CommandContext): Promise<void> {
  metrics.send({
    category: 'interactive',
    group: 'device',
    action: 'add device',
  });

  if (underDevelopment.deviceManagementV2.get()) {
    new AddOwnedDevicePanel(
      context.extensionContext.extensionUri,
      new AddOwnedDeviceService(
        ssh_config.defaultConfigPath,
        '/etc/hosts',
        context.output,
        context.deviceRepository.owned
      ),
      new AddOwnedDeviceViewContext(os.userInfo().username)
    );
  } else {
    const hostname = await promptNewHostname(
      'Add New Device',
      context.deviceRepository.owned
    );
    if (!hostname) {
      return;
    }
    await context.deviceRepository.owned.addDevice(hostname);
  }
}
