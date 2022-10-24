// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import {OutputChannel} from 'vscode';
import {OwnedDeviceRepository} from '../device_repository';
import {buildSshArgs, SshConfigHostEntry} from '../ssh_util';
import {DeviceClient} from './../device_client';
import {DutConnectionConfig, DutNetworkType} from './add_owned_device_model';

// TODO(joelbecker): import normally once tsconfig esModuleInterop=true doesn't break a lot of
// other things.
const SSHConfig = require('ssh-config');

export class AddOwnedDeviceService {
  constructor(
    readonly sshConfigPath: string,
    readonly hostsPath: string,
    readonly testingRsaPath: string,
    private readonly output: OutputChannel,
    private readonly deviceRepository: OwnedDeviceRepository
  ) {}

  /**
   * Runs the connection test step, applying other optional operations such as updating the SSH
   * config file. If the connection fails, an error is thrown, and changes are rolled back.
   *
   * TODO(joelbecker): Apply SSH config changes after connection succeeds, once we do not rely on it
   * for connection.
   *
   * @return string device info if connection is successful.
   * @throws Error if unable to connect, or unable to update the SSH config file.
   */
  public async configureAndTestConnection(
    config: DutConnectionConfig
  ): Promise<void> {
    if (config.addToSshConfig) {
      this.addHostToSshConfig(config);
    }
    try {
      await this.tryToConnect(config);

      if (config.addToHostsFile) {
        // TODO(joelbecker): this.addToHostsFile(config); // but with execSudo() or the like
      }

      await this.deviceRepository.addDevice(config.hostname);
    } catch (e) {
      this.output.appendLine(JSON.stringify(e));
      try {
        this.removeHostFromSshConfig(config.hostname);
      } catch (e2) {
        this.output.appendLine(JSON.stringify(e2));
        // TODO: log unable to rollback ssh config change
      }
      throw e;
    }
  }

  // TODO(joelbecker): Get from user configuration.
  private sshConfigHostTemplate(
    config: DutConnectionConfig
  ): SshConfigHostEntry {
    if (config.networkType === DutNetworkType.OFFICE) {
      return {
        Host: config.hostname,
        Hostname:
          config.networkType === DutNetworkType.OFFICE
            ? config.ipAddress
            : '127.0.0.1',
        Port:
          config.networkType === DutNetworkType.OFFICE
            ? 22
            : config.forwardedPort ?? undefined,
        CheckHostIP: 'no',
        ControlMaster: 'auto',
        ControlPath: '/tmp/ssh-%r%h%p',
        ControlPersist: '3600',
        IdentitiesOnly: 'yes',
        IdentityFile: this.testingRsaPath,
        StrictHostKeyChecking: 'no',
        User: 'root',
        UserKnownHostsFile: '/dev/null',
        VerifyHostKeyDNS: 'no',
        ProxyCommand: 'corp-ssh-helper -dest4 %h %p', // corp-ssh-helper is installed by default on gLinux and gMac
        // HostKeyAlias
      };
    } else {
      return {
        Host: config.hostname,
        Hostname: '127.0.0.1',
        Port: config.forwardedPort ?? undefined,
        User: 'root',
        IdentitiesOnly: 'yes',
        IdentityFile: '%d/.ssh/testing_rsa',
        StrictHostKeyChecking: 'no',
      };
    }
  }

  private async tryToConnect(config: DutConnectionConfig): Promise<void> {
    const client = new DeviceClient(
      this.output,
      buildSshArgs(
        config.hostname,
        config.forwardedPort ?? undefined,
        this.sshConfigHostTemplate(config)
      )
    );
    await client.readLsbRelease();
  }

  private addHostToSshConfig(config: DutConnectionConfig): void {
    this.modifySshConfig(sshConfig => {
      sshConfig.prepend(this.sshConfigHostTemplate(config));
    });
  }

  private removeHostFromSshConfig(hostname: string): void {
    this.modifySshConfig((sshConfig: typeof SSHConfig) => {
      sshConfig.remove({Host: hostname});
    });
  }

  private modifySshConfig(modifier: (config: typeof SSHConfig) => void): void {
    const fileContents = fs.readFileSync(this.sshConfigPath).toString();
    const sshConfig = SSHConfig.parse(fileContents);
    modifier(sshConfig);
    // TODO(joelbecker): backup carefully. Manage sequence of .bak.1 .bak.2 etc.
    fs.copyFileSync(this.sshConfigPath, this.sshConfigPath + '.bak');
    fs.writeFileSync(this.sshConfigPath, sshConfig.toString());
  }
}
