// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {Position} from './position';

export class Range {
  readonly start: Position;
  readonly end: Position;
  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number
  ) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }

  contains(_positionOrRange: Range | Position): boolean {
    throw new Error('Not implemented');
  }

  intersection(_range: Range): Range {
    throw new Error('Not implemented');
  }

  isEqual(_other: Range): boolean {
    throw new Error('Not implemented');
  }

  union(_other: Range): Range {
    throw new Error('Not implemented');
  }

  with(start?: Position, end?: Position): Range;
  with(change: {end: Position; start: Position}): Range;
  with(): Range {
    throw new Error('Not implemented');
  }
}
