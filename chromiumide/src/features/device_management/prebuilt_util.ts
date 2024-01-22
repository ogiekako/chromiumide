// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {
  compareCrosVersions,
  parseFullCrosVersion,
} from '../../common/image_version';
import * as services from '../../services';
/**
 * Returns a list of prebuilt images available for the given board and image type, matching the
 * version pattern (all versions by default).
 * Returned versions are sorted in the reverse-chronological order (newest first).
 */
export async function listPrebuiltVersions(
  board: string,
  imageType: string,
  chrootService: services.chromiumos.ChrootService,
  logger: vscode.OutputChannel,
  versionPattern = '*'
): Promise<string[]> {
  // gs://chromeos-image-archive/ contains prebuilt image files.
  // https://chromium.googlesource.com/chromiumos/docs/+/HEAD/gsutil.md
  const result = await chrootService.exec(
    'gsutil',
    [
      'ls',
      `gs://chromeos-image-archive/${board}-${imageType}/${versionPattern}/image.zip`,
    ],
    {
      logger: logger,
      sudoReason: 'to list available prebuilt images',
    }
  );
  if (result instanceof Error) {
    throw result;
  }

  const versionRegexp = /\/(R\d+-\d+\.\d+\.\d+(-\d+-\d+)?)\//gm;
  const versions = [];
  for (;;) {
    const match = versionRegexp.exec(result.stdout);
    if (!match) {
      break;
    }
    versions.push({
      imageString: match[1],
      parsedImage: parseFullCrosVersion(match[1]),
    });
  }

  versions.sort((va, vb) =>
    compareCrosVersions(va.parsedImage, vb.parsedImage)
  );
  versions.reverse();
  return versions.map(v => v.imageString);
}
