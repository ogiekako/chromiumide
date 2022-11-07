// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as commonUtil from '../../common/common_util';

/**
 * For operating on Git repos created in test (which typically live in /tmp).
 *
 * All functions throw errors.
 */
export class Git {
  constructor(readonly root: string) {}

  /** Creates the root directory and runs `git init`. */
  async init(opts?: {internal: boolean}) {
    await fs.promises.mkdir(this.root, {recursive: true});
    await commonUtil.execOrThrow('git', ['init'], {cwd: this.root});
    const remote = opts?.internal
      ? [
          'cros-internal',
          'https://chrome-internal.googlesource.com/chromeos/internal-project',
        ]
      : ['cros', 'https://chromium.googlesource.com/chromiumos/chromite'];
    await commonUtil.execOrThrow('git', ['remote', 'add', ...remote], {
      cwd: this.root,
    });
  }

  async addAll() {
    await commonUtil.execOrThrow('git', ['add', '.'], {cwd: this.root});
  }

  async checkout(name: string, opts?: {createBranch?: boolean}) {
    const args = ['checkout', ...cond(opts?.createBranch, '-b'), name];
    await commonUtil.execOrThrow('git', args, {cwd: this.root});
  }

  /** Run git commit and returns commit hash. */
  async commit(
    message: string,
    opts?: {amend?: boolean; all?: boolean}
  ): Promise<string> {
    const args = [
      'commit',
      '--allow-empty',
      ...cond(opts?.amend, '--amend'),
      ...cond(opts?.all, '--all'),
      '-m',
      message,
    ];
    await commonUtil.execOrThrow('git', args, {
      cwd: this.root,
    });
    return (
      await commonUtil.execOrThrow('git', ['rev-parse', 'HEAD'], {
        cwd: this.root,
      })
    ).stdout.trim();
  }
}

function cond(test: boolean | undefined, value: string): string[] {
  return test ? [value] : [];
}
