// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {StatusManager} from '../../../../shared/app/ui/bg_task_status';
import {ChrootService} from '../../../services/chromiumos';
import * as compdbGenerator from './compdb_generator';
import {CppCodeCompletion} from './cpp_code_completion';

export class ChromiumosCppCodeCompletion implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(statusManager: StatusManager, chrootService: ChrootService) {
    const cppCodeCompletion = new CppCodeCompletion(statusManager);
    this.subscriptions.push(cppCodeCompletion);

    cppCodeCompletion.register(
      output => new compdbGenerator.Platform2(chrootService, output),
      output => new compdbGenerator.PlatformEc(chrootService, output)
    );
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions.splice(0)).dispose();
  }
}
