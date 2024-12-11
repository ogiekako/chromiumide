// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {vscodeRegisterCommand} from '../../../../shared/app/common/vscode/commands';

export const COMMAND_SHOW_LOGS = 'chromiumide.chromium.java.showLogs';

export function registerCommands(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscodeRegisterCommand(COMMAND_SHOW_LOGS, () => {
      output.show();
    })
  );
}
