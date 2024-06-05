// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import * as dateFns from 'date-fns';
import glob from 'glob';
import * as commonUtil from '../../shared/app/common/common_util';
import {getDriver} from '../../shared/app/common/driver_repository';
import {escapeArray} from '../../shared/app/common/shutil';
import {assertNever} from '../../shared/app/common/typecheck';
import {vscodeRegisterCommand} from '../../shared/app/common/vscode/commands';
import {parseLocalSyslogLine} from '../common/syslog';

const driver = getDriver();

// http://go/gcertstatus#scripting-with-gcertstatus
enum Gcertstatus {
  Success = 0,
  GenericFailure = 1,
  Invalid = 5,
  Expired = 9,
  NotFound = 90,
  ExpireSoon = 91,
}

/**
 * Enables command to run gcert.
 */
export class Gcert implements vscode.Disposable {
  private readonly onDidRunEmitter = new vscode.EventEmitter<void>();
  readonly onDidRun = this.onDidRunEmitter.event;

  private readonly subscriptions = [
    this.onDidRunEmitter,
    vscodeRegisterCommand('chromiumide.gcert.run', async () => {
      await this.run();
      this.onDidRunEmitter.fire();
    }),
  ];

  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly tempDir = '/tmp',
    private readonly syslogPath = '/var/log/messages'
  ) {}

  private async run() {
    driver.metrics.send({
      group: 'gcert',
      category: 'interactive',
      description: 'running gcert is requested',
      name: 'gcert_run',
    });

    let mustAshSshAuthSock = false;
    const gcertStatus = await this.runGcertstatus();
    switch (gcertStatus) {
      case Gcertstatus.Success:
      case Gcertstatus.ExpireSoon:
      case Gcertstatus.Expired:
      case Gcertstatus.Invalid:
        break; // run gcert
      case Gcertstatus.GenericFailure:
        this.output.show();
        void vscode.window.showErrorMessage(
          'gcertstatus failed with code 1; cannot recover'
        );
        return;
      case Gcertstatus.NotFound: {
        mustAshSshAuthSock = true;
        break;
      }
      default:
        assertNever(gcertStatus);
    }

    const syslog = new File(this.syslogPath);

    let lastSyslogError = '';

    let exitCode;
    for (const askSshAuthSock of [false, true]) {
      if (!askSshAuthSock && mustAshSshAuthSock) continue;

      let sshAuthSock = undefined;
      if (askSshAuthSock) {
        sshAuthSock = await this.askSshAuthSock();
        if (!sshAuthSock) break;
      }

      const syslogPrevSize = await syslog.size();

      exitCode = await this.runGcert(sshAuthSock);

      if (exitCode === 0) {
        void vscode.window.showInformationMessage('gcert succeeded');
        return;
      }

      const syslogCurSize = await syslog.size();
      const gcertEntries = (await syslog.read(syslogPrevSize, syslogCurSize))
        .toString('utf8')
        .split('\n')
        .map(parseLocalSyslogLine)
        .filter(x => x?.process.startsWith('gcert['));
      if (gcertEntries.length > 0) {
        lastSyslogError = gcertEntries[gcertEntries.length - 1]!.message;
      } else {
        lastSyslogError = '';
      }
    }

    void vscode.window.showErrorMessage(
      'gcert failed' + (lastSyslogError ? ': ' + lastSyslogError : '')
    );

    driver.metrics.send({
      group: 'gcert',
      category: 'error',
      description: 'gcert exit status (-1 if not available)',
      name: 'gcert_nonzero_exit_code',
      gcertstatus: gcertStatus,
      exit_code: exitCode ?? -1,
    });
  }

  /**
   * Lets the user select SSH_AUTH_SOCK if there are multiple candidates.
   * If there is only one candidate, it returns the value without asking.
   */
  private async askSshAuthSock(): Promise<string | undefined> {
    const cands = await util.promisify(glob)(
      path.join(this.tempDir, 'ssh-*/agent.*')
    );

    if (cands.length === 0) {
      void vscode.window.showErrorMessage('No SSH session found');
      return;
    }
    if (cands.length === 1) {
      return cands[0];
    }

    const items: (vscode.QuickPickItem & {durationMs: number})[] =
      await Promise.all(
        cands.map(async cand => {
          const mtime = await fs.promises
            .stat(cand)
            .then(stat => stat.mtime)
            .catch(() => new Date(0));

          // Show duration rather than the mtime, because client and server timezone
          // might differ.
          const duration = dateFns.intervalToDuration({
            start: mtime,
            end: new Date(),
          });
          const durationStr =
            (duration.days ? `${duration.days} days ` : '') +
              dateFns.formatDuration(duration, {
                format: ['hours', 'minutes'],
                zero: false,
              }) || '0 minutes';
          const description = durationStr + ' ago';

          return {
            label: cand,
            description,
            durationMs: dateFns.milliseconds(duration),
          };
        })
      );
    items.sort((a, b) => a.durationMs - b.durationMs);

    const choice = await vscode.window.showQuickPick(items, {
      title: 'Select SSH_AUTH_SOCK to use to run gcert',
    });

    if (!choice) {
      void (async () => {
        const url = 'http://go/chromiumide-doc-gcert-ssh-auth-sock';
        const choice = await vscode.window.showErrorMessage(
          `gcert: not run because SSU_AUTH_SOCK selector was dismissed; see [our guide](${url}) to learn which to select`,
          'Open Guide'
        );
        if (choice) {
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
      })();
    }

    return choice?.label;
  }

  private async runGcertstatus(): Promise<Gcertstatus> {
    const result = await commonUtil.exec('gcertstatus', [], {
      logger: this.output,
      ignoreNonZeroExit: true,
    });
    if (result instanceof Error) {
      return Gcertstatus.GenericFailure;
    }
    return result.exitStatus as Gcertstatus;
  }

  /** @returns exit code of gcert */
  private async runGcert(
    sshAuthSock: undefined | string
  ): Promise<number | undefined> {
    const terminal = vscode.window.createTerminal();
    const waitClose = new Promise<void>(resolve => {
      const subscription = vscode.window.onDidCloseTerminal(closedTerminal => {
        if (closedTerminal === terminal) {
          subscription.dispose();
          resolve();
        }
      });
    });
    terminal.show();

    const command = sshAuthSock ? ['env', `SSH_AUTH_SOCK=${sshAuthSock}`] : [];
    command.push('gcert');
    terminal.sendText('exec ' + escapeArray(command));

    await waitClose;

    return terminal.exitStatus?.code;
  }

  dispose(): void {
    vscode.Disposable.from(...this.subscriptions.splice(0)).dispose();
  }
}

class File {
  constructor(private readonly filename: string) {}

  async size(): Promise<number> {
    try {
      const stat = await fs.promises.stat(this.filename);
      return stat.size;
    } catch {
      return 0;
    }
  }

  async read(start: number, end: number): Promise<Buffer> {
    let h;
    try {
      h = await fs.promises.open(this.filename);
    } catch {
      return Buffer.alloc(0);
    }
    const r = h.createReadStream({
      start,
      end,
    });

    const chunks: Buffer[] = [];
    r.on('data', chunk => {
      chunks.push(chunk as Buffer);
    });

    return new Promise(resolve => {
      r.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
