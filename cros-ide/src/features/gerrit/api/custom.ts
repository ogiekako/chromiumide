// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as git from '../git';
import * as https from '../https';
import * as api from './gerrit';

// Our custom APIs for Gerrit

/** FilePathToBaseCommentInfos extended with extra fields */
export type FilePathToCommentInfos = {
  readonly [filePath: string]: readonly CommentInfo[];
};

/** BaseCommentInfo extended with extra fields */
export interface CommentInfo extends api.BaseCommentInfo {
  /** Whether the comment is public or draft */
  readonly isPublic: boolean;
  /** Ensures that the author field is not undefined */
  readonly author: api.AccountInfo;
}

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
export async function fetchOrThrow<T>(
  repoId: git.RepoId,
  path: string,
  authCookie?: string
): Promise<T | undefined> {
  const url = `${git.gerritUrl(repoId)}/${path}`;
  const options =
    authCookie !== undefined ? {headers: {cookie: authCookie}} : undefined;
  const str = await https.getOrThrow(url, options);
  return str === undefined ? undefined : api.parseResponse(str);
}

/** Fetches the user's account info */
export async function fetchMyAccountInfoOrThrow(
  repoId: git.RepoId,
  authCookie?: string
): Promise<api.AccountInfo | undefined> {
  return fetchOrThrow(repoId, 'accounts/me', authCookie);
}

/** Fetches the change with all revisions */
export async function fetchChangeOrThrow(
  repoId: git.RepoId,
  changeId: string,
  authCookie?: string
): Promise<api.ChangeInfo | undefined> {
  return await fetchOrThrow(
    repoId,
    `changes/${changeId}?o=ALL_REVISIONS`,
    authCookie
  );
}

/** Fetches all public comments of the change */
export async function fetchPublicCommentsOrThrow(
  repoId: git.RepoId,
  changeId: string,
  authCookie?: string
): Promise<FilePathToCommentInfos | undefined> {
  const baseCommentInfosMap: api.FilePathToBaseCommentInfos | undefined =
    await fetchOrThrow(repoId, `changes/${changeId}/comments`, authCookie);
  if (!baseCommentInfosMap) return undefined;

  const res: {[filePath: string]: CommentInfo[]} = {};
  for (const [filePath, baseCommentInfos] of Object.entries(
    baseCommentInfosMap
  )) {
    res[filePath] = baseCommentInfos.map(c => ({
      ...c,
      author: c.author!,
      isPublic: true,
    }));
  }
  return res;
}

/** Fetches all draft comments of the change */
export async function fetchDraftCommentsOrThrow(
  repoId: git.RepoId,
  changeId: string,
  myAccountInfo: api.AccountInfo,
  authCookie?: string
): Promise<FilePathToCommentInfos | undefined> {
  const baseCommentInfosMap: api.FilePathToBaseCommentInfos | undefined =
    await fetchOrThrow(repoId, `changes/${changeId}/drafts`, authCookie);
  if (!baseCommentInfosMap) return undefined;

  const res: {[filePath: string]: CommentInfo[]} = {};
  for (const [filePath, baseCommentInfos] of Object.entries(
    baseCommentInfosMap
  )) {
    res[filePath] = baseCommentInfos.map(c => ({
      ...c,
      author: myAccountInfo,
      isPublic: false,
    }));
  }
  return res;
}

/**
 * Merge FilePathToCommentInfos
 */
export function mergeCommentInfos(
  commentInfosMap1: FilePathToCommentInfos,
  commentInfosMap2?: FilePathToCommentInfos
): FilePathToCommentInfos {
  const res: {[filePath: string]: CommentInfo[]} = {};
  for (const [filePath, commentInfos1] of Object.entries(commentInfosMap1)) {
    if (res[filePath] === undefined) res[filePath] = [];
    res[filePath].push(...commentInfos1);
  }
  if (commentInfosMap2) {
    for (const [filePath, commentInfos2] of Object.entries(commentInfosMap2)) {
      if (res[filePath] === undefined) res[filePath] = [];
      res[filePath].push(...commentInfos2);
    }
  }
  return res;
}
