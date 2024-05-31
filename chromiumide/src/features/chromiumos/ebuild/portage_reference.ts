// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as vscode from 'vscode';
import {
  EBUILD_DEFINED_VARIABLES,
  EBUILD_DEFINED_VARIABLES_HOVER_STRING,
  EBUILD_PHASE_FUNCTIONS,
  EBUILD_PHASE_FUNCTIONS_HOVER_STRING,
  PORTAGE_PREDEFINED_READ_ONLY_VARAIBLES,
  PORTAGE_PREDEFINED_READ_ONLY_VARIABLES_HOVER_STRING,
} from '../../../../server/ebuild_lsp/shared/constants';
import {getDriver} from '../../../../shared/app/common/driver_repository';

/**
 * NOTE: Migration to LSP is happening. Keep the algorithm in sync with
 * server/ebuild_lsp/hover.ts.
 */

const driver = getDriver();

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      {language: 'shellscript', pattern: '**/*.{ebuild,eclass}'},
      new PortageReferenceHoverProvider()
    )
  );
}

export class PortageReferenceHoverProvider implements vscode.HoverProvider {
  constructor() {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);
    if (PORTAGE_PREDEFINED_READ_ONLY_VARAIBLES.includes(word)) {
      driver.metrics.send({
        category: 'background',
        group: 'ebuild',
        name: 'show_portage_predefined_read_only_variable_hover',
        description:
          'ebuild: user hovered on portage predefined read-only variable',
        word: word,
      });
      return new vscode.Hover(
        PORTAGE_PREDEFINED_READ_ONLY_VARIABLES_HOVER_STRING(word),
        range
      );
    }
    if (EBUILD_DEFINED_VARIABLES.includes(word)) {
      driver.metrics.send({
        category: 'background',
        group: 'ebuild',
        name: 'show_ebuild_defined_variable_hover',
        description: 'ebuild: user hovered on ebuild-defined variable',
        word: word,
      });
      return new vscode.Hover(
        EBUILD_DEFINED_VARIABLES_HOVER_STRING(word),
        range
      );
    }
    if (EBUILD_PHASE_FUNCTIONS.includes(word)) {
      driver.metrics.send({
        category: 'background',
        group: 'ebuild',
        name: 'show_ebuild_phase_function_hover',
        description: 'ebuild: user hovered on an ebuild phase function',
        word: word,
      });
      return new vscode.Hover(EBUILD_PHASE_FUNCTIONS_HOVER_STRING(word), range);
    }
  }
}

export const TEST_ONLY = {
  PORTAGE_PREDEFINED_READ_ONLY_VARIABLES_HOVER_STRING,
  EBUILD_DEFINED_VARIABLES_HOVER_STRING,
  EBUILD_PHASE_FUNCTIONS_HOVER_STRING,
};
