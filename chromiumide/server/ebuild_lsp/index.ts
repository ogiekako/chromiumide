// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {TextDocument} from 'vscode-languageserver-textdocument';
import {
  Disposable,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  createConnection,
} from 'vscode-languageserver/node';

export function runEbuildLsp(): void {
  const connection = createConnection(ProposedFeatures.all);

  const documents = new TextDocuments(TextDocument);

  const subscriptions: Disposable[] = [
    connection,
    connection.onInitialize((_params: InitializeParams) => {
      const result: InitializeResult = {
        capabilities: {
          hoverProvider: true,
        },
      };
      return result;
    }),

    connection.onHover(_item => {
      return {
        contents: {
          kind: 'plaintext',
          value: 'Hello',
        },
      };
    }),

    documents.listen(connection),

    connection.onShutdown(() => {
      for (const x of subscriptions) {
        x.dispose();
      }
    }),
  ];

  connection.listen();
}
