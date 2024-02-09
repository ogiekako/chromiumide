// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as linkProvider from './link_provider';
import * as portageReference from './portage_reference';

export function activate(
  context: vscode.ExtensionContext,
  chromiumosRoot: string
): void {
  linkProvider.activate(context, chromiumosRoot);
  portageReference.activate(context);
}
