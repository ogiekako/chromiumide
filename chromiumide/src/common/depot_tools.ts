// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../../shared/app/common/common_util';
import {getDriver} from '../../shared/app/common/driver_repository';
import * as config from '../../shared/app/services/config';

const driver = getDriver();

// Expand the `PATH` environment variable to `<custom_setting>:$PATH:~/depot_tools`. This gives
// preference to the custom setting and a fallback on a default.
export async function envForDepotTools(): Promise<{PATH: string}> {
  let env = await depotToolsPath();

  // The `cros` command should be in depot tools and available.
  //
  // If it is not then we should prompt the user to specify the path to the
  // depot_tools checkout. We do this a single time only in case the user does
  // not properly select a path. Their command will likely fail but they will
  // be re-prompted on next attempt.
  const whichCros = await commonUtil.exec('which', ['cros'], {
    env,
  });

  if (whichCros instanceof Error) {
    const depotToolsUri = await vscode.window.showOpenDialog({
      title: 'ChromiumIDE: Depot Tools not found, please select its folder',
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
    });
    if (depotToolsUri) {
      await config.paths.depotTools.update(depotToolsUri[0].fsPath);
      env = await depotToolsPath();
    }
  }

  return env;
}

async function depotToolsPath(): Promise<{PATH: string}> {
  const depotToolsConfig = config.paths.depotTools.get();
  const pathVar = await driver.getUserEnvPath();
  const originalPath = pathVar instanceof Error ? undefined : pathVar;
  const homeDepotTools = path.join(os.homedir(), 'depot_tools');

  const expandedPath: string[] = [];
  if (depotToolsConfig) {
    expandedPath.push(depotToolsConfig);
  }
  if (originalPath) {
    expandedPath.push(originalPath);
  }
  expandedPath.push(homeDepotTools);

  return {
    PATH: expandedPath.join(':'),
  };
}
