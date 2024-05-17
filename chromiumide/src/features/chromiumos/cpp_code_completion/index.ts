// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {
  CppCodeCompletion,
  GeneratorFactory,
} from '../../../common/cpp_xrefs/cpp_code_completion';
import {ChrootService} from '../../../services/chromiumos';
import * as compdbGenerator from './compdb_generator';

export class ChromiumosCppCodeCompletion {
  constructor(
    chrootService: ChrootService,
    private readonly cppCodeCompletion: CppCodeCompletion
  ) {
    cppCodeCompletion.register(
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
}
