// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as mockFs from 'mock-fs';
import 'jasmine';
import * as sshConfig from '../../../../../features/chromiumos/device_management/ssh_config';
import {FakeDeviceRepository} from './fake_device_repository';

const TEST_CONFIG_FILE = `
# Comments are ignored
Host dut1
Host *
Host *.cros
Host !*.exclude
Host dut2 dut3 dut*
HOST dut4
# Host dutX
`;

const CONFIG_PATH = '/test/.ssh/config';

describe('SSH config parser', () => {
  beforeEach(() => {
    mockFs({
      [CONFIG_PATH]: TEST_CONFIG_FILE,
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('readConfiguredSshHosts', () => {
    it('can parse simple configs', async () => {
      const result = await sshConfig.readConfiguredSshHosts(CONFIG_PATH);
      expect(result).toEqual(['dut1', 'dut2', 'dut3', 'dut4']);
    });
  });

  describe('isLabAccessConfigured', () => {
    it('can check if lab access is configured', async () => {
      await fs.promises.writeFile(CONFIG_PATH, 'Host chromeos*');
      expect(await sshConfig.isLabAccessConfigured(CONFIG_PATH)).toBeTrue();

      await fs.promises.writeFile(CONFIG_PATH, 'Host android*');
      expect(await sshConfig.isLabAccessConfigured(CONFIG_PATH)).toBeFalse();
    });
  });

  describe('readUnaddedSshHosts', () => {
    it('returns hosts from the config that do not exist in the repository', async () => {
      const deviceRepository = new FakeDeviceRepository([
        {hostname: 'dut2'},
        {hostname: 'dut4'},
      ]);

      const result = await sshConfig.readUnaddedSshHosts(
        deviceRepository,
        CONFIG_PATH
      );

      expect(result).toEqual(['dut1', 'dut3']);
    });
  });
});
