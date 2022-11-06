// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as mockFs from 'mock-fs';
import {OwnedDeviceRepository} from '../../../../../../features/chromiumos/device_management/device_repository';
import {
  DutNetworkType,
  DutConnectionConfig,
} from '../../../../../../features/chromiumos/device_management/owned/add_owned_device_model';
import {VoidOutputChannel} from './../../../../../testing/fakes/output_channel';
import {AddOwnedDeviceService} from './../../../../../../features/chromiumos/device_management/owned/add_owned_device_service';
import * as deviceRepository from './../../../../../../features/chromiumos/device_management/device_repository';

describe('AddOwnedDeviceService', () => {
  describe('addHostToSshConfig', () => {
    const configContentsBefore = `
Host preexisting-entry
  Hostname 127.0.0.1
  Port 4242
`;
    const configContentsAfter = `Host FakeDut
  Hostname 1.2.3.4
  Port 22
  CheckHostIP no
  ControlMaster auto
  ControlPath /tmp/ssh-%r%h%p
  ControlPersist 3600
  IdentitiesOnly yes
  IdentityFile /test/rsa
  StrictHostKeyChecking no
  User root
  UserKnownHostsFile /dev/null
  VerifyHostKeyDNS no
  ProxyCommand corp-ssh-helper -dest4 %h %p


Host preexisting-entry
  Hostname 127.0.0.1
  Port 4242
`;
    const dutConnectionConfig: DutConnectionConfig = {
      networkType: DutNetworkType.OFFICE,
      ipAddress: '1.2.3.4',
      hostname: 'FakeDut',
      forwardedPort: null,
      addToSshConfig: true,
      addToHostsFile: false,
    };
    const startingTime = new Date(2022, 0, 2, 3, 4, 5);
    const backupFilename = 'config.cros-ide-bak.2022-Jan-02--03-04-05';

    beforeEach(() => {
      mockFs({
        '/test/.ssh/config': configContentsBefore,
      });
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(startingTime));
    });

    afterEach(() => {
      jasmine.clock().uninstall();
      mockFs.restore();
    });

    it('backs up the .ssh config and adds the new entry, preserving previous entries', async () => {
      const svc = new AddOwnedDeviceService(
        '/test/.ssh/config',
        '/test/etc/hosts',
        '/test/rsa',
        new VoidOutputChannel(),
        new OwnedDeviceRepository()
      );

      svc.addHostToSshConfig(dutConnectionConfig);

      const files = await fs.promises.readdir('/test/.ssh');
      expect(files).toEqual(['config', backupFilename]);
      const backupContents = fs
        .readFileSync(`/test/.ssh/${backupFilename}`)
        .toString();
      const newContents = fs.readFileSync('/test/.ssh/config').toString();
      expect(newContents).toBe(configContentsAfter);
      expect(backupContents).toBe(configContentsBefore);
    });
  });

  describe('getExistingHostnames', () => {
    beforeEach(() => {
      mockFs({
        '/test/.ssh/config': `
Host host1
  Hostname 1.2.3.4
  Port 4321

Host host2 host3
  Hostname 1.2.3.4
  Port 4321

Host host4 host5
  Hostname 1.2.3.4
  Port 4321
`,
      });
    });

    afterEach(() => {
      mockFs.restore();
    });

    it('reads all hosts from the ssh config file that are not already in the device repository', async () => {
      const ownedDeviceRepo = new OwnedDeviceRepository();
      spyOn(ownedDeviceRepo, 'getDevices').and.returnValue(
        Promise.resolve([
          {hostname: 'host4', category: deviceRepository.DeviceCategory.OWNED},
        ])
      );
      const svc = new AddOwnedDeviceService(
        '/test/.ssh/config',
        '/test/etc/hosts',
        '/test/rsa',
        new VoidOutputChannel(),
        ownedDeviceRepo
      );

      const result = await svc.getUnaddedSshConfigHostnames();

      expect(result).toEqual(['host1', 'host2', 'host3', 'host5']);
    });
  });
});
