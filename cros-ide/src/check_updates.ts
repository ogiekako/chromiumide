// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import * as semver from 'semver';
import * as ideUtil from './ide_util';
import * as install from './tools/install';
import * as metrics from './features/metrics/metrics';

const EXTENSION_ID = 'google.cros-ide';

export function run(): void {
  void (async () => {
    try {
      const extension = vscode.extensions.getExtension(EXTENSION_ID);
      // This should not happen.
      if (!extension) {
        return;
      }

      const installed = new semver.SemVer(extension.packageJSON.version);
      const marketplaceInitialRelease = new semver.SemVer('0.1.0');
      if (installed.compare(marketplaceInitialRelease) < 0) {
        await navigateToMarketplace();
      }
    } catch (err) {
      // The caller cannot handle errors for the async task.
      metrics.send({
        category: 'error',
        group: 'misc',
        description: `checking for updates failed: ${err}`,
      });
      throw err;
    }
  })();
}

let navigateToMarketplaceShown = false;
async function navigateToMarketplace() {
  if (navigateToMarketplaceShown) {
    return;
  }
  const chosen = await vscode.window.showInformationMessage(
    'New CrOS IDE is available in the marketplace',
    INSTALL
  );
  navigateToMarketplaceShown = true;

  if (chosen !== INSTALL) {
    return;
  }

  await vscode.commands.executeCommand('extension.open', EXTENSION_ID);
  await vscode.commands.executeCommand(
    'workbench.extensions.installExtension',
    EXTENSION_ID
  );
}

const INSTALL = 'Install';

export async function showInstallPrompt(
  installed: semver.SemVer,
  available: semver.SemVer,
  gsutil: string
) {
  const selection = await vscode.window.showInformationMessage(
    `New version of CrOS IDE is available (installed: ${installed}, available: ${available}).`,
    INSTALL,
    'Dismiss'
  );
  if (selection !== INSTALL) {
    return;
  }

  const exe = ideUtil.vscodeExecutablePath();
  if (exe instanceof Error) {
    await handleFailure(exe);
    return;
  }

  // HACK(b:228887382): CODE_SERVER_PARENT_PID is set when the extension is running in code-server.
  // When another code-server executable is executed from the extension, it sees the environment
  // variable, and behaves differently than when it's run without it, resulting in installation
  // failure. To workaround, here we temporarily unset the environment variable before calling
  // install().
  const codeServerPid = process.env.CODE_SERVER_PARENT_PID;
  if (codeServerPid) {
    delete process.env.CODE_SERVER_PARENT_PID;
  }

  try {
    await install.install(exe, available, gsutil);
  } catch (e) {
    await handleFailure(e as Error);
    return;
  } finally {
    if (codeServerPid) {
      process.env.CODE_SERVER_PARENT_PID = codeServerPid;
    }
  }
  await vscode.window.showInformationMessage(
    'Please reload the window to finish updating CrOS IDE'
  );
}

const UPDATE_MANUALLY = 'Update manually';

async function handleFailure(e: Error) {
  // TODO(oka): add an option to open issue tracker using cros-ide.fileIdeBug command.
  const selection = await vscode.window.showErrorMessage(
    `Failed to install; please file a bug: ${e.message}`,
    UPDATE_MANUALLY
  );
  if (selection === UPDATE_MANUALLY) {
    void vscode.env.openExternal(
      vscode.Uri.parse('http://go/cros-ide-quickstart#updating')
    );
  }
}
