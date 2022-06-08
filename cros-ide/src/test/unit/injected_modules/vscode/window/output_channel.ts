// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as vscode from 'vscode'; // import types only
import {VoidOutputChannel} from '../../../../testing/fakes';

export function createOutputChannel(name: string): vscode.OutputChannel {
  return new VoidOutputChannel(name);
}
