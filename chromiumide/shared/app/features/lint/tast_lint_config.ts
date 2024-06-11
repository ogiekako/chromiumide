// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as commonUtil from '../../common/common_util';
import {getDriver} from '../../common/driver_repository';
import {LintConfig} from './lint_config';
import {tastLintPath, isTastFile, parseGolintOutput} from './util';

const driver = getDriver();

export class TastLintConfig implements LintConfig {
  readonly languageId = 'go';

  readonly name = 'tast lint';

  async executable(realpath: string): Promise<string | undefined> {
    if (!isTastFile(realpath)) return;

    const goFound = await checkForGo();
    if (!goFound) return;

    const linterSubpath = tastLintPath(realpath);
    if (!linterSubpath) return;

    const chromiumosRoot = await driver.cros.findSourceDir(realpath);
    if (chromiumosRoot === undefined) return;

    return driver.path.join(chromiumosRoot, linterSubpath);
  }

  arguments(path: string): string[] {
    return [path];
  }

  parse(
    stdout: string,
    _stderr: string,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    return parseGolintOutput(stdout, document);
  }

  cwd(exePath: string): string | undefined {
    return driver.path.dirname(driver.path.dirname(exePath));
  }

  // run_lint.sh exits with non-zero status when the file cannot be parsed,
  // which happens often when the code is edited.
  readonly ignoreEmptyDiagnostics = true;
}

let goWarningShown = false;
async function checkForGo(): Promise<boolean> {
  // Go needs to be installed for tast linter to work.
  const res = await commonUtil.exec('which', ['go']);
  if (!(res instanceof Error)) {
    return true;
  }
  if (goWarningShown) {
    return false;
  }
  goWarningShown = true;
  // Suggest the user install go.
  const choice = await vscode.window.showInformationMessage(
    '*** Linting Tast repos requires the Golang go command. Please install the "go" command (Go language) to a location listed in $PATH.',
    'Troubleshoot'
  );
  if (choice) {
    void vscode.env.openExternal(
      vscode.Uri.parse('http://go/chromiumide-doc-go-not-found')
    );
  }
  return false;
}
