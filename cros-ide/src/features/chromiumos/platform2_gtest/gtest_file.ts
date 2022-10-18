// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {Config} from './config';
import {GtestCase} from './gtest_case';
import * as parser from './parser';

/**
 * Represents a unit test file containing at least one gtest test case.
 */
export class GtestFile implements vscode.Disposable {
  private readonly controller: vscode.TestController;
  private readonly cases = new Map<vscode.TestItem, GtestCase>();
  private readonly item?: vscode.TestItem;

  private constructor(
    cfg: Config,
    uri: vscode.Uri,
    instances: parser.TestInstance[]
  ) {
    if (instances.length === 0) {
      throw new Error('Internal error: instances must not be empty');
    }

    this.controller = cfg.testControllerRepository.getOrCreate();

    this.item = this.controller.createTestItem(
      uri.toString(),
      uri.path.split('/').pop()!,
      uri
    );
    this.controller.items.add(this.item);

    for (const {range, suite, name} of instances) {
      const testCase = new GtestCase(cfg, this.item, uri, range, suite, name);
      this.cases.set(testCase.item, testCase);
    }
  }

  static createIfHasTest(
    cfg: Config,
    uri: vscode.Uri,
    content: string
  ): GtestFile | undefined {
    const testInstances = parser.parse(content);
    if (testInstances.length === 0) {
      return undefined;
    }
    return new GtestFile(cfg, uri, testInstances);
  }

  dispose() {
    for (const testCase of this.cases.values()) {
      testCase.dispose();
    }
    this.cases.clear();

    if (this.item) {
      this.controller.items.delete(this.item.id);
    }
  }
}
