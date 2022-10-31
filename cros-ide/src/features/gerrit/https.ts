// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as https from 'https';

/**
 * Fetches raw data from Gerrit API over https.
 */
export async function getOrThrow(
  url: string,
  optionsForTesting: https.RequestOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, optionsForTesting, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`status code: ${res.statusCode}`));
        }
        const body: Uint8Array[] = [];
        res.on('data', data => body.push(data));
        res.on('end', () => {
          resolve(Buffer.concat(body).toString());
        });
      })
      .on('error', reject);
  });
}
