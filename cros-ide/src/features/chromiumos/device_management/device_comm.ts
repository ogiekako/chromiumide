// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as child_process from 'child_process';

/**
 * Helps communicate with a DUT (device under test). It helps run commands over ssh, and retrieves
 * device information.
 */
export class DeviceComm {
  private sshCmd: string;
  constructor(
    private host: string,
    private port: number | null = null,
    private sshOptions: object = {},
    private sshConfigPath: string | null = null
  ) {
    this.sshCmd = 'ssh -v';
    if (sshConfigPath) {
      this.sshCmd += ` -F ${sshConfigPath}`;
    }
    this.sshCmd += ` root@${host}`;
    if (port) {
      this.sshCmd += ' -p ' + port;
    }
    this.port = this.port ?? 22;
  }

  public readDeviceInfo() {}

  public async readLsbRelease() {
    const output = await this.runCommand('cat /etc/lsb-release');
    const entries = output.stdout
      .split('\n')
      .map(line => line.split(/=(.*)/s).slice(0, 2)) // Split key/value on first '='
      .filter(kv => kv.length === 2); // Only include key/value output lines
    const lsbRelease = Object.assign({}, ...entries.map(x => ({[x[0]]: x[1]})));
    return lsbRelease;
  }

  public async runCommand(
    cmd: string
  ): Promise<{stdout: string; stderr: string}> {
    return new Promise((resolve, reject) => {
      child_process.exec(`${this.sshCmd} ${cmd}`, (error, stdout, stderr) => {
        if (error) {
          reject({error: error, stderr: stderr});
        }
        resolve({stdout: stdout, stderr: stderr});
      });
    });
  }
}
