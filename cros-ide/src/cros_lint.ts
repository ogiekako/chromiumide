// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as childProcess from 'child_process';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const collection = vscode.languages.createDiagnosticCollection('cros-lint');
  if (vscode.window.activeTextEditor) {
    updateCrosLintDiagnostics(
        vscode.window.activeTextEditor.document, collection);
  }
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(
      editor => {
        if (editor) {
          updateCrosLintDiagnostics(editor.document, collection);
        }
      }));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(
      document => {
        updateCrosLintDiagnostics(document, collection);
      }));
}

function updateCrosLintDiagnostics(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection): void {
  if (document && document.uri.scheme === 'file') {
    childProcess.exec(`cros lint ${document.uri.fsPath}`,
        (_error, stdout, stderr) => {
          const diagnostics = parseCrosLint(stdout, stderr, document);
          collection.set(document.uri, diagnostics);
        });
  } else {
    collection.clear();
  }
}

export function parseCrosLint(
    stdout: string, stderr: string, document: vscode.TextDocument)
    :vscode.Diagnostic[] {
  const lineRE = /^([^ \n]+):([0-9]+):  (.*)  \[([^ ]+)\] \[([1-5])\]/gm;
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
    if (file === document.uri.fsPath) {
      const diagnostic = new vscode.Diagnostic(
          new vscode.Range(
              new vscode.Position(line - 1, 0),
              new vscode.Position(line - 1, Number.MAX_VALUE),
          ),
          message,
          vscode.DiagnosticSeverity.Warning,
      );
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}
