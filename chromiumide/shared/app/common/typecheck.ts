// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/** Statically asserts that the value has the `never` type */
export function assertNever(x: never): never {
  throw new Error(`Internal Error: assertNever(${x})`);
}
