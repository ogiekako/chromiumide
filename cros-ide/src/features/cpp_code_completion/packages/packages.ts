// Copyright 2022 The ChromiumOS Authors.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as path from 'path';
import {findChroot, sourceDir} from '../../../common/common_util';
import {KNOWN_PACKAGES} from './known_packages';
import {SourceDir, PackageInfo} from './types';

// TODO(oka): Make this a singleton if this is used from multiple places.
export class Packages {
  private mapping = new Map<SourceDir, PackageInfo>();
  constructor() {
    for (const packageInfo of KNOWN_PACKAGES) {
      this.mapping.set(packageInfo.sourceDir, packageInfo);
    }
  }

  /**
   * Get information of the package that would compile the file and generates
   * compilation database, or null if no such package is known.
   */
  async fromFilepath(filepath: string): Promise<PackageInfo | null> {
    let realpath = '';
    try {
      realpath = await fs.promises.realpath(filepath);
    } catch (_e) {
      // If filepath is an absolute path, assume it's a realpath. This is
      // convenient for testing, where the file may not exist.
      if (path.isAbsolute(filepath)) {
        realpath = filepath;
      } else {
        return null;
      }
    }

    const chroot = findChroot(realpath);
    if (chroot === undefined) {
      return null;
    }
    const sourcePath = sourceDir(chroot);

    let relPath = path.relative(sourcePath, realpath);
    if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
      return null;
    }
    while (relPath !== '.') {
      const info = this.mapping.get(relPath);
      if (info !== undefined) {
        return info;
      }
      relPath = path.dirname(relPath);
    }
    return null;
  }
}
