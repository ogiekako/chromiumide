// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Hover, HoverParams} from 'vscode-languageserver';
import {URI} from 'vscode-uri';
import {Context} from './context';
import {
  EBUILD_DEFINED_VARIABLES,
  EBUILD_DEFINED_VARIABLES_HOVER_STRING,
  EBUILD_PHASE_FUNCTIONS,
  EBUILD_PHASE_FUNCTIONS_HOVER_STRING,
  PORTAGE_PREDEFINED_READ_ONLY_VARAIBLES,
  PORTAGE_PREDEFINED_READ_ONLY_VARIABLES_HOVER_STRING,
} from './shared';
import {getEbuildWordRangeAtPosition} from './util';

export function onHover(
  ctx: Context,
  {textDocument, position}: HoverParams
): Hover | undefined {
  const document = ctx.fs.read(URI.parse(textDocument.uri));
  if (!document) return;

  const range = getEbuildWordRangeAtPosition(document, position);

  const word = document.getText(range);

  if (PORTAGE_PREDEFINED_READ_ONLY_VARAIBLES.includes(word)) {
    return {
      contents: PORTAGE_PREDEFINED_READ_ONLY_VARIABLES_HOVER_STRING(word),
      range,
    };
  }
  if (EBUILD_DEFINED_VARIABLES.includes(word)) {
    return {contents: EBUILD_DEFINED_VARIABLES_HOVER_STRING(word), range};
  }
  if (EBUILD_PHASE_FUNCTIONS.includes(word)) {
    return {contents: EBUILD_PHASE_FUNCTIONS_HOVER_STRING(word), range};
  }
}
