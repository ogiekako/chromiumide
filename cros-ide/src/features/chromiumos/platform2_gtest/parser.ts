// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';

export type TestInstance = {
  range: vscode.Range; // 0-based
  suite: string;
  name: string;
};

// Match with strings like "TEST(foo, bar)".
//
// TODO(oka): Support other test definitions like TEST_F and TEST_P.
// TODO(oka): Support the TEST broken across multiple lines.
// https://google.github.io/googletest/reference/testing.html
const GTEST_RE = /^\s*TEST\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/;

/**
 * Parse the given file content and finds gtest test cases.
 */
export function parse(content: string): TestInstance[] {
  const res: TestInstance[] = [];
  content.split('\n').forEach((line, lineNo) => {
    const m = GTEST_RE.exec(line);
    if (!m) {
      return;
    }
    const range = new vscode.Range(
      new vscode.Position(lineNo, 0),
      new vscode.Position(lineNo, m[0].length)
    );
    res.push({
      range,
      suite: m[1],
      name: m[2],
    });
  });
  return res;
}
