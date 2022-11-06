// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  Device,
  IDeviceRepository,
} from '../../../../../features/chromiumos/device_management/device_repository';

export class FakeDeviceRepository implements IDeviceRepository<Device> {
  constructor(readonly devices: Device[]) {}

  getDevices(): Promise<Device[]> {
    return Promise.resolve(this.devices);
  }
}
