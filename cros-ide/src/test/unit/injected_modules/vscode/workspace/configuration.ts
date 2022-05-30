// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as vscode from 'vscode'; // import types only

export function getConfiguration(
  _section?: string,
  _scope?: vscode.ConfigurationScope | null
): vscode.WorkspaceConfiguration {
  throw new Error('vscode.workspace.getConfiguration(): not implemented');
}
