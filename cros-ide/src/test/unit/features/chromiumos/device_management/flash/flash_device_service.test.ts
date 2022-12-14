// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'jasmine';
import {FakeChrootService} from '../../../../../testing/fakes/fake_chroot_service';
import {Source} from './../../../../../../common/common_util';
import * as model from './../../../../../../features/chromiumos/device_management/flash/flash_device_model';
import {FlashDeviceService} from './../../../../../../features/chromiumos/device_management/flash/flash_device_service';
import * as chroot from './../../../../../../services/chromiumos/chroot';
import {ChrootService} from './../../../../../../services/chromiumos/chroot';
import {VoidOutputChannel} from './../../../../../testing/fakes/output_channel';

describe('FlashDeviceService', () => {
  describe('flash', () => {
    it('runs cros flash with the given flash parameters', async () => {
      const chrootService = new FakeChrootService() as ChrootService;
      spyOn(chroot, 'execInChroot');
      const service = new FlashDeviceService(
        chrootService,
        new VoidOutputChannel()
      );
      const config: model.FlashDeviceViewState = {
        step: model.FlashDeviceStep.FLASH_PROGRESS,
        buildSelectionType: model.BuildSelectionType.LATEST_OF_CHANNEL,
        hostname: 'test-host',
        board: 'zork',
        buildChannel: 'stable',
        buildInfo: undefined,
        flashCliFlags: ['--flag1', '--flag3'],
        flashProgress: 0.0,
        flashingComplete: false,
        flashError: '',
        buildsBrowserState: {
          builds: [],
          board: '',
          loadingBuilds: false,
        },
      };

      await service.flashDevice(config);

      const xbuddyPath = service.buildXbuddyPath(config);
      expect(chroot.execInChroot).toHaveBeenCalledOnceWith(
        'chroot/src' as Source,
        'cros',
        [
          'flash',
          '--log-level=debug',
          '--flag1',
          '--flag3',
          'ssh://test-host',
          xbuddyPath,
        ],
        jasmine.any(Object)
      );
    });
  });
});
