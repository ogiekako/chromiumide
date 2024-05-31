// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {TextDocument} from 'vscode-languageserver-textdocument';
import {
  Disposable,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from 'vscode-languageserver/node';
import {URI} from 'vscode-uri';
import {Context} from './context';
import {onHover} from './hover';
import {VirtualFileSystem} from './virtual_file_system';

export function runEbuildLsp(): void {
  const connection = createConnection(ProposedFeatures.all);

  const documents = new TextDocuments(TextDocument);

  const fs = new VirtualFileSystem('shellscript');

  const ctx: Context = {
    fs,
    connection,
  };

  const subscriptions: Disposable[] = [
    connection,
    connection.onInitialize((_params: InitializeParams) => {
      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Full,
          hoverProvider: true,
        },
      };
      return result;
    }),

    connection.onDidChangeTextDocument(item => {
      if (item.contentChanges.length > 1) {
        throw new Error('Internal error: unexpected incremental changes');
      }
      fs.write(URI.parse(item.textDocument.uri), item.contentChanges[0].text);
    }),

    connection.onHover(item => onHover(ctx, item)),

    documents.listen(connection),

    connection.onShutdown(() => {
      for (const x of subscriptions.reverse()) {
        x.dispose();
      }
    }),
  ];

  connection.listen();
}
