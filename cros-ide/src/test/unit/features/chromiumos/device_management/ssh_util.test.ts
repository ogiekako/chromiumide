// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'jasmine';
import * as vscode from 'vscode';
import * as sshUtil from '../../../../../features/device_management/ssh_util';

describe('SSH utility', () => {
  const FAKE_EXTENSION_URI = vscode.Uri.parse('file:///path/to/extension');

  describe('buildSshCommand', () => {
    it('computes SSH arguments for host without port number', () => {
      const args = sshUtil.buildSshCommand(
        'somehost',
        FAKE_EXTENSION_URI,
        ['-o', 'SomeOption=on'],
        'true'
      );
      expect(args).toEqual([
        'ssh',
        '-i',
        '/path/to/extension/resources/testing_rsa',
        '-o',
        'SomeOption=on',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        'root@somehost',
        'true',
      ]);
    });

    it('computes SSH arguments for host with port number', () => {
      const args = sshUtil.buildSshCommand(
        'somehost:12345',
        FAKE_EXTENSION_URI,
        ['-o', 'SomeOption=on'],
        'true'
      );
      expect(args).toEqual([
        'ssh',
        '-p',
        '12345',
        '-i',
        '/path/to/extension/resources/testing_rsa',
        '-o',
        'SomeOption=on',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        'root@somehost',
        'true',
      ]);
    });
  });

  describe('buildDeviceSshArgs', () => {
    it('includes -o arg for each ssh config option', () => {
      const result = sshUtil.buildSshArgs('host1', undefined, {
        Hostname: 'hostname1',
        Port: 123,
      });
      const args = result.join(' ');
      expect(args).toContain('-o Hostname=hostname1');
      expect(args).toContain('-o Port=123');
    });

    it('includes the given additional args', () => {
      const result = sshUtil.buildSshArgs(
        'host1',
        undefined,
        {
          Hostname: 'hostname1',
        },
        ['-i', 'a/path']
      );
      const args = result.join(' ');
      expect(args).toContain('-i a/path');
    });
  });

  describe('buildMinimalDeviceSshArgs', () => {
    const resultWithPort = sshUtil
      .buildMinimalDeviceSshArgs('host1:123', FAKE_EXTENSION_URI)
      .join(' ');

    it('includes the options to disable fingerprint prompt', () => {
      expect(resultWithPort).toContain('-o StrictHostKeyChecking=no');
      expect(resultWithPort).toContain('-o UserKnownHostsFile=/dev/null');
    });

    it('includes -p when port supplied', () => {
      expect(resultWithPort).toContain('-p 123');
    });

    it('does not include -p when port is not supplied', () => {
      const result = sshUtil
        .buildMinimalDeviceSshArgs('host1', FAKE_EXTENSION_URI)
        .join(' ');
      expect(result).not.toContain('-p');
    });

    it('includes the testing RSA path', () => {
      expect(resultWithPort).toContain(
        '-i /path/to/extension/resources/testing_rsa'
      );
    });

    it('does not add the Host SSH config entry in the -o args', () => {
      const config = {
        Host: 'host1',
        Hostname: 'hostname1',
      };
      const result = sshUtil.buildSshArgs('host1', undefined, config);
      const args = result.join(' ');
      expect(args).not.toContain('-o Host=');
    });
  });
});
