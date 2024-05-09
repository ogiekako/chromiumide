// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {StatusManager} from '../../../../shared/app/ui/bg_task_status';
import {ChrootService} from '../../../services/chromiumos';
import * as compdbGenerator from './compdb_generator';
import {CppCodeCompletion, GeneratorFactory} from './cpp_code_completion';

export class ChromiumosCppCodeCompletion implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private cppCodeCompletion: CppCodeCompletion;

  constructor(statusManager: StatusManager, chrootService: ChrootService) {
    this.cppCodeCompletion = new CppCodeCompletion(statusManager);
    this.subscriptions.push(this.cppCodeCompletion);

    this.cppCodeCompletion.register(
      output => new compdbGenerator.Platform2(chrootService, output),
      output => new compdbGenerator.PlatformEc(chrootService, output)
    );
  }

  registerExtraGeneratorFactoryForTesting(f: GeneratorFactory): void {
    this.cppCodeCompletion.register(f);
  }

  /**
   * Fired when generator may be triggered. Tests can use this event to wait until a custom
   * `generate` method is called in a loop.
   */
  get onDidMaybeGenerateForTesting(): vscode.Event<void> {
    return this.cppCodeCompletion.onDidMaybeGenerate;
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions.splice(0)).dispose();
  }
}
