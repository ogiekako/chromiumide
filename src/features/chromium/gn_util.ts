// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as gnArgs from './gn_args';

/**
 * Checks if the build configuration in the given output directory targets Android.
 */
export async function isAndroidBuild(
  srcPath: string,
  outDir: string,
  token: vscode.CancellationToken
): Promise<boolean> {
  const info = await gnArgs.readGnArgs(srcPath, outDir, token);
  if (info.type === 'success') {
    return info.args.computedTargetOs === 'android';
  }
  return false;
}
