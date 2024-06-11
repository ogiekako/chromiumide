// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {crosExeFor, driver} from '../../common/chromiumos/cros';
import {ProcessEnv} from '../../common/exec/types';
import {assertNever} from '../../common/typecheck';
import * as config from '../../services/config';
import {LintConfig} from './lint_config';
import {
  createDiagnostic,
  isTastFile,
  parseGolintOutput,
  sameFile,
} from './util';

export class CrosLintConfig implements LintConfig {
  readonly name = 'cros lint';
  constructor(
    readonly languageId: 'cpp' | 'gn' | 'go' | 'python' | 'shellscript'
  ) {}

  async executable(realpath: string): Promise<string | undefined> {
    // cros lint is not configured to run in PRESUBMIT.cfg in tast, tast-tests, tast-tests-private.
    // TODO(b/337138396): Honor PRESUBMIT.cfg in general.
    if (isTastFile(realpath)) {
      return;
    }
    return crosExeFor(realpath);
  }

  arguments(path: string): string[] {
    switch (this.languageId) {
      case 'cpp':
      case 'gn':
      case 'go':
      case 'python':
        return ['lint', path];
      case 'shellscript':
        return ['lint', '--output=parseable', path];
      default:
        assertNever(this.languageId);
    }
  }

  parse(
    stdout: string,
    stderr: string,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    switch (this.languageId) {
      case 'cpp':
        return parseCrosLintCpp(stdout, stderr, document);
      case 'gn':
        return parseCrosLintGn(stdout, stderr, document);
      case 'go':
        return paresCrosLintGo(stdout, stderr, document);
      case 'python':
        return parseCrosLintPython(stdout, stderr, document);
      case 'shellscript':
        return parseCrosLintShell(stdout, stderr, document);
      default:
        assertNever(this.languageId);
    }
  }

  cwd(exePath: string): string | undefined {
    switch (this.languageId) {
      case 'gn':
        // gnlint.py needs to be run inside ChromiumOS source tree,
        // otherwise it complains about formatting.
        return driver.path.dirname(exePath);
      case 'cpp':
      case 'go':
      case 'python':
      case 'shellscript':
        return;
      default:
        assertNever(this.languageId);
    }
  }

  get ignoreEmptyDiagnostics(): boolean | undefined {
    switch (this.languageId) {
      case 'gn':
        // gnlint.py exits with non-zero code when syntax error exists,
        // but not handled here because those overlap with other exetnsions.
        return true;
      case 'python':
        // The linter exits with non-zero code when the file is not auto-formatted.
        return true;
      case 'cpp':
      case 'go':
      case 'shellscript':
        return;
      default:
        assertNever(this.languageId);
    }
  }

  async extraEnv(exe: string, _path: string): Promise<ProcessEnv | undefined> {
    if (this.languageId !== 'go') return;

    // Find golint executable in the chroot because cros lint
    // checks /usr/bin, where the chroot golint is located.
    const chroot = await driver.cros.findChroot(exe);
    if (chroot === undefined) {
      return undefined;
    }
    const goBin = driver.path.join(chroot, '/usr/bin');
    // Add goBin to the PATH so that cros lint can lint go files
    // outside the chroot.
    const pathVar = await driver.getUserEnvPath();
    let newPathVar = `${
      pathVar instanceof Error || pathVar === undefined ? '' : pathVar
    }:${goBin}`;
    // Prepend go.toolsGopath if available
    if (vscode.extensions.getExtension('golang.Go')) {
      const toolsGopathConfig = config.goExtension.toolsGopath.get();
      if (toolsGopathConfig) {
        newPathVar = `${toolsGopathConfig}:${newPathVar}`;
      }
    }

    return {PATH: newPathVar};
  }
}

function parseCrosLintCpp(
  stdout: string,
  stderr: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const lineRE = /^([^ \n]+):([0-9]+): {2}(.*) {2}\[([^ ]+)\] \[([1-5])\]/gm;
  const diagnostics: vscode.Diagnostic[] = [];
  let match: RegExpExecArray | null;
  // stdout and stderr are merged, because we saw that warnings can go to
  // either.
  // TODO(b/214322467): Figure out when we should use stderr and when stdout.
  while ((match = lineRE.exec(stdout + '\n' + stderr)) !== null) {
    const file = match[1];
    let line = Number(match[2]);
    // Warning about missing copyright is reported at hard coded line 0.
    // This seems like a bug in cpplint.py, which otherwise uses 1-based
    // line numbers.
    if (line === 0) {
      line = 1;
    }
    const message = match[3];
    if (sameFile(document.uri.fsPath, file)) {
      diagnostics.push(createDiagnostic(message, 'CrOS lint', line));
    }
  }
  return diagnostics;
}

// Parse output from platform2/common-mk/gnlint.py on a GN file.
function parseCrosLintGn(
  stdout: string,
  _stderr: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  // Only the errors that have location in the file are captured.
  // There are two categories of errors without line/column number:
  // - file not formatted by gn-format: should do auto-format upon save
  // - wrong commandline arguments: should be covered by extension unit test
  // So these are ignored.
  const lineRE = /ERROR: ([^ \n:]+):([0-9]+):([0-9]+): (.*)/gm;
  const diagnostics: vscode.Diagnostic[] = [];
  let match: RegExpExecArray | null;
  while ((match = lineRE.exec(stdout)) !== null) {
    const file = match[1];
    const line = Number(match[2]);
    const startCol = Number(match[3]);
    const message = match[4];
    // Keep the same logic for matching file names,
    // although here it effectively no-op (always BUILD.gn)
    if (sameFile(document.uri.fsPath, file)) {
      diagnostics.push(
        createDiagnostic(message, 'CrOS GN lint', line, startCol)
      );
    }
  }
  return diagnostics;
}

function paresCrosLintGo(
  stdout: string,
  _stderr: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  return parseGolintOutput(stdout, document);
}

// Parse output from cros lint on Python files
function parseCrosLintPython(
  stdout: string,
  _stderr: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const lineRE = /^([^ \n:]+):([0-9]+):([0-9]+): (.*)/gm;
  const diagnostics: vscode.Diagnostic[] = [];
  let match: RegExpExecArray | null;
  while ((match = lineRE.exec(stdout)) !== null) {
    const file = match[1];
    const line = Number(match[2]);
    // Column number from the python linter is 0-based.
    const startCol = Number(match[3]) + 1;
    const message = match[4];
    if (sameFile(document.uri.fsPath, file)) {
      diagnostics.push(createDiagnostic(message, 'CrOS lint', line, startCol));
    }
  }
  return diagnostics;
}

// Parse output from cros lint --output=parseable on shell files.
function parseCrosLintShell(
  stdout: string,
  stderr: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const lineRE = /^([^ \n:]+):([0-9]+):([0-9]+): (.*)/gm;
  const diagnostics: vscode.Diagnostic[] = [];
  let match: RegExpExecArray | null;
  while ((match = lineRE.exec(stdout)) !== null) {
    const file = match[1];
    const line = Number(match[2]);
    const startCol = Number(match[3]);
    const message = match[4];
    if (sameFile(document.uri.fsPath, file)) {
      diagnostics.push(createDiagnostic(message, 'CrOS lint', line, startCol));
    }
  }

  const warningLineRE =
    /[0-9]+:[0-9]+:[0-9]+: WARNING:([^\n:]+):(([0-9]+):)? (.*)/gm;
  while ((match = warningLineRE.exec(stdout)) !== null) {
    const file = match[1];
    const message = match[4];
    let line: number;
    if (match[3]) {
      line = Number(match[3]);
    } else if (
      // See //chromite/lint/linters/whitespace.py
      message === 'delete trailing blank lines' ||
      message === 'file needs a trailing newline'
    ) {
      line = document.lineCount;
    } else {
      line = 1;
    }
    if (sameFile(document.uri.fsPath, file)) {
      diagnostics.push(createDiagnostic(message, 'CrOS lint', line));
    }
  }
  return diagnostics;
}
