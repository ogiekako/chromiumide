// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as git from '../git';
import * as https from '../https';
import * as api from './gerrit';

// Our custom APIs for Gerrit

/**
 * Turn api.AccountInfo into the name string
 */
export function accountName(a: api.AccountInfo): string {
  if (a.display_name) return a.display_name;
  if (a.name) return a.name;
  return 'id' + a._account_id;
}

/**
 * Gets a raw string from Gerrit REST API with an auth cookie,
 * returning undefined on 404 error.
 * It can throw an error from https.getOrThrow.
 */
export async function fetchOrThrow(
  repoId: git.RepoId,
  path: string,
  authCookie?: string
): Promise<string | undefined> {
  const url = `${git.gerritUrl(repoId)}/${path}`;
  const options =
    authCookie !== undefined ? {headers: {cookie: authCookie}} : undefined;
  const str = await https.getOrThrow(url, options);
  return str?.substring(')]}\n'.length);
}

/** Fetches the change with all revisions */
export async function fetchChangeOrThrow(
  repoId: git.RepoId,
  changeId: string,
  authCookie?: string
): Promise<api.ChangeInfo | undefined> {
  const content = await fetchOrThrow(
    repoId,
    `changes/${changeId}?o=ALL_REVISIONS`,
    authCookie
  );
  if (!content) return undefined;
  return JSON.parse(content) as api.ChangeInfo;
}

/** Fetches all comments of the change */
export async function fetchCommentsOrThrow(
  repoId: git.RepoId,
  changeId: string,
  authCookie?: string
): Promise<api.FilePathToCommentInfos | undefined> {
  const content = await fetchOrThrow(
    repoId,
    `changes/${changeId}/comments`,
    authCookie
  );
  if (!content) return undefined;
  return JSON.parse(content) as api.FilePathToCommentInfos;
}
