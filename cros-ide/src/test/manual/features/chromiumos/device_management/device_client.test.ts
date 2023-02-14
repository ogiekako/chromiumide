// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ConsoleOutputChannel} from '../../../../testing/fakes/output_channel';
import {CipdRepository} from '../../../../../common/cipd';
import {buildMinimalDeviceSshArgs} from '../../../../../features/device_management/ssh_util';
import {getExtensionUri} from '../../../../testing';
import {
  CrosfleetDutLeaseOutput,
  CrosfleetRunner,
} from '../../../../../features/device_management/crosfleet';
import {DeviceClient} from '../../../../../features/device_management/device_client';

const TIMEOUT = 2 * 60 * 1000;

// This should be more than the highest reasonable duration for all the tests to run, but not more
// in case the test process gets killed before we can abandon the lease.
const LEASE_MINUTES = 2;

/**
 * The test set assures end-to-end integration with devices, by temporarily leasing a device from
 * the lab. Leasing can take ~45s, so this is a very long test set.
 */
describe('Device client integration', () => {
  // Not using cleanState here, because we do wish to share an actual (mutable) device among the
  // spec, so that we don't have to wait for a device lease for each spec.
  let client: DeviceClient;
  let crosfleetRunner: CrosfleetRunner;
  let lease: CrosfleetDutLeaseOutput;

  beforeAll(async () => {
    crosfleetRunner = new CrosfleetRunner(
      new CipdRepository(),
      new ConsoleOutputChannel()
    );
    lease = await crosfleetRunner.requestLease({
      model: 'phaser',
      durationInMinutes: LEASE_MINUTES,
    });
    client = new DeviceClient(
      new ConsoleOutputChannel(),
      //vscode.window.createOutputChannel('void'),
      buildMinimalDeviceSshArgs(lease.dutHostname, getExtensionUri())
    );
  }, TIMEOUT);

  afterAll(async () => {
    if (lease.dutHostname) {
      await crosfleetRunner.abandonLease(lease.dutHostname);
    }
  });

  it(
    'reads /etc/lsb-release',
    async () => {
      const lsbRelease = await client.readLsbRelease();
      expect(lsbRelease.chromeosReleaseBoard).toEqual('octopus');
      expect(lsbRelease.devicetype).toEqual('CHROMEBOOK');
    },
    TIMEOUT
  );
});
