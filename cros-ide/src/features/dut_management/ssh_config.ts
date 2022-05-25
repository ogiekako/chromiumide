// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export async function readConfiguredSshHosts(
  configPath: string = path.join(os.homedir(), '.ssh', 'config')
): Promise<string[]> {
  let content: string;
  try {
    content = await fs.promises.readFile(configPath, {
      encoding: 'utf-8',
    });
  } catch {
    // Ignore errors on reading the config file.
    return [];
  }

  // We do rough regexp matching to extract hosts from a config.
  // This is not a complete solution (e.g. Include directive is not supported),
  // but covers most cases.
  const hostRegexp = /^\s*Host\s+(.*)$/gim;

  const hosts = [];
  let match: RegExpExecArray | null;
  while ((match = hostRegexp.exec(content)) !== null) {
    if (match === null) {
      break;
    }
    for (const name of match[1].split(/\s+/g)) {
      if (!name.includes('*') && !name.startsWith('!')) {
        hosts.push(name);
      }
    }
  }
  return hosts;
}
