// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ideUtil from '../../ide_util';

export function isExperimentsEnabled(): boolean {
  return ideUtil
    .getConfigRoot()
    .get<boolean>('underDevelopment.deviceManagement', false);
}
