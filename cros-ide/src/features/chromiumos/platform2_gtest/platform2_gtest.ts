// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as services from '../../../services';

export class Platform2Gtest implements vscode.Disposable {
  private readonly disposable: vscode.Disposable[] = [];
  dispose() {
    vscode.Disposable.from(...this.disposable.reverse()).dispose();
  }

  constructor(
    _chromiumosRoot: string,
    _chrootService: services.chromiumos.ChrootService
  ) {
    // TODO(oka): Implement it.
    void vscode.window.showInformationMessage('Hello platform2 gtest!');
  }
}
