// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as dateFns from 'date-fns';
import * as commonUtil from '../../common/common_util';
import * as services from '../../services';
import {underDevelopment} from '../../services/config';
import * as gitDocument from '../../services/git_document';
import * as bgTaskStatus from '../../ui/bg_task_status';
import * as metrics from '../metrics/metrics';
import * as api from './api';
import * as git from './git';
import * as helpers from './helpers';
import * as https from './https';
import * as auth from './auth';
import * as virtualDocument from './virtual_document';

// Task name in the status manager.
const GERRIT = 'Gerrit';

export function activate(
  context: vscode.ExtensionContext,
  statusManager: bgTaskStatus.StatusManager,
  _gitDocumentProvider: gitDocument.GitDocumentProvider,
  gitDirsWatcher: services.GitDirsWatcher
) {
  const outputChannel = vscode.window.createOutputChannel('CrOS IDE: Gerrit');
  context.subscriptions.push(outputChannel);
  statusManager.setTask(GERRIT, {
    status: bgTaskStatus.TaskStatus.OK,
    outputChannel,
  });

  new virtualDocument.GerritDocumentProvider().activate(context);

  const commentController = vscode.comments.createCommentController(
    'cros-ide-gerrit',
    'CrOS IDE Gerrit'
  );

  context.subscriptions.push(commentController);

  if (underDevelopment.gerrit) {
    // Test auth for Gerrit
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'cros-ide.gerrit.internal.testAuth',
        async () => {
          const authCookie = await gerrit.readAuthCookie();
          // Fetch from some internal Gerrit change
          const out = await gerrit.getOrThrow(
            'cros-internal',
            'changes/I6743130cd3a84635a66f54f81fa839060f3fcb39/comments',
            authCookie
          );
          outputChannel.appendLine(
            '[Internal] Output for the Gerrit auth test:\n' + out
          );
          // Judge that the auth has succeeded if the output is a valid JSON
          void vscode.window.showInformationMessage(
            out && JSON.parse(out) ? 'Auth succeeded!' : 'Auth failed!'
          );
        }
      )
    );
  }

  const focusCommentsPanel = 'cros-ide.gerrit.focusCommentsPanel';
  context.subscriptions.push(
    vscode.commands.registerCommand(focusCommentsPanel, () => {
      void vscode.commands.executeCommand(
        'workbench.action.focusCommentsPanel'
      );
      metrics.send({
        category: 'interactive',
        group: 'gerrit',
        action: 'focus comments panel',
      });
    })
  );
  context.subscriptions;
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10 // puts this item left of clangd
  );
  statusBar.command = focusCommentsPanel;

  const gerrit = new Gerrit(
    commentController,
    outputChannel,
    statusBar,
    statusManager
  );

  let gitHead: string | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      void gerrit.showComments(document.fileName, false);
    }),
    vscode.commands.registerCommand(
      'cros-ide.gerrit.collapseAllCommentThreads',
      () => {
        // See https://github.com/microsoft/vscode/issues/158316 to learn more.
        //
        // TODO(b:255468946): Clean-up this method when the upstream API stabilizes.
        //   1. Use updated CommentThread JS API if it is updated.
        //   2. Do not change the collapsibleState.
        //   3. Collapse all comments, not just those in the active text editor.
        void vscode.commands.executeCommand(
          // Collapses all comments in the active text editor.
          'workbench.action.collapseAllComments'
        );
        gerrit.collapseAllCommentThreads();
        metrics.send({
          category: 'interactive',
          group: 'gerrit',
          action: 'collapse all comment threads',
        });
      }
    ),
    gitDirsWatcher.onDidChangeHead(async event => {
      // 1. Check !event.head to avoid closing comments
      //    when the only visible file is closed or replaced.
      // 2. Check event.head !== gitHead to avoid reloading comments
      //    on "head_1 -> undefined -> head_1" sequence.
      if (event.head && event.head !== gitHead) {
        gitHead = event.head;
        await gerrit.showComments(event.gitDir);
      }
    })
  );
}

class Gerrit {
  // list of [commit id, threads] pairs
  private partitionedCommentThreads?: [string, FilePathToCommentThreads][];
  private vscodeCommentThreads: vscode.CommentThread[] = [];

  constructor(
    private readonly commentController: vscode.CommentController,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly statusBar: vscode.StatusBarItem,
    private readonly statusManager: bgTaskStatus.StatusManager
  ) {}

  /** Generator for iterating over all Threads. */
  *commentThreads(): Generator<CommentThread> {
    if (this.partitionedCommentThreads) {
      for (const [, commentThreadsMap] of this.partitionedCommentThreads) {
        for (const [, commentThreads] of Object.entries(commentThreadsMap)) {
          for (const commentThread of commentThreads) {
            yield commentThread;
          }
        }
      }
    }
  }

  /**
   * Fetches comments on changes in the Git repo which contains
   * `filePath` (file or directory) and shows them with
   * proper repositioning based on the local diff. It caches the response
   * from Gerrit and uses it unless fetch is true.
   */
  async showComments(filePath: string, fetch = true) {
    try {
      const gitDir = await this.findGitDir(filePath);
      if (!gitDir) return;
      if (fetch) {
        await this.fetchComments(gitDir);
        this.clearVscodeCommentThreads();
      }
      if (!this.partitionedCommentThreads) {
        return;
      }

      const localCommitIds = await this.filterLocalCommitIds(
        this.partitionedCommentThreads.map(commitThreads => commitThreads[0]),
        gitDir
      );

      for (const [commitId, commentThreadsMap] of this
        .partitionedCommentThreads) {
        // We still want to show comments that cannot be repositioned correctly.
        if (localCommitIds.includes(commitId)) {
          await this.shiftCommentThreadsMap(
            gitDir,
            commitId,
            commentThreadsMap
          );
        }
        this.displayCommentThreads(
          this.commentController,
          commentThreadsMap,
          gitDir
        );
      }
      this.updateStatusBar();
      if (fetch && this.vscodeCommentThreads.length > 0) {
        this.sendMetrics();
      }
    } catch (err) {
      this.showErrorMessage({
        log: `Failed to fetch Gerrit comments: ${err}`,
        metrics: 'Failed to fetch Gerrit comments (top-level error)',
      });
      return;
    }
  }

  /**
   * Finds the Git directory for the file
   * or returns undefined with logging when the directory is not found.
   */
  private async findGitDir(filePath: string): Promise<string | undefined> {
    const gitDir = commonUtil.findGitDir(filePath);
    if (!gitDir) {
      this.outputChannel.appendLine('Git directory not found for ' + filePath);
      return;
    }
    return gitDir;
  }

  /**
   * Executes git remote to get RepoId or returns undefined
   * showing an error message if the id is not found.
   */
  private async getRepoId(gitDir: string): Promise<git.RepoId | undefined> {
    const repoId = await git.getRepoId(gitDir, this.outputChannel);
    if (repoId instanceof git.UnknownRepoError) {
      this.showErrorMessage({
        log:
          'Unknown remote repo detected: ' +
          `id ${repoId.repoId}, url ${repoId.repoUrl}`,
        metrics: 'unknown git remote result',
      });
      return;
    }
    if (repoId instanceof Error) {
      this.showErrorMessage({
        log: `'git remote' failed: ${repoId.message}`,
        metrics: 'git remote failed',
      });
      return;
    }
    const repoKind = repoId === 'cros' ? 'Public' : 'Internal';
    this.outputChannel.appendLine(
      `${repoKind} Chrome remote repo detected at ${gitDir}`
    );
    return repoId;
  }

  collapseAllCommentThreads() {
    for (const vscodeCommentThread of this.vscodeCommentThreads) {
      vscodeCommentThread.collapsibleState =
        vscode.CommentThreadCollapsibleState.Collapsed;
    }
  }

  updateStatusBar() {
    let total = 0;
    let unresolved = 0;
    for (const thread of this.commentThreads()) {
      total++;
      if (thread.unresolved) {
        unresolved++;
      }
    }
    if (total > 0) {
      this.statusBar.text = `$(comment) ${unresolved}`;
      this.statusBar.tooltip = `Gerrit comments: ${unresolved} unresolved (${total} total)`;
      this.statusBar.show();
    } else {
      this.statusBar.hide();
    }
  }

  sendMetrics() {
    metrics.send({
      category: 'background',
      group: 'gerrit',
      action: 'update comments',
      value: this.vscodeCommentThreads.length,
    });
  }

  /**
   * Retrieves data from Gerrit API and applies basic transformations
   * to partition it into threads and by commit id. The data is then
   * stored in `this.partitionedCommentThreads`.
   */
  private async fetchComments(gitDir: string): Promise<void> {
    const authCookie = await this.readAuthCookie();
    const repoId = await this.getRepoId(gitDir);
    if (repoId === undefined) return;
    const gitLogInfos = await git.readGitLog(
      gitDir,
      `${repoId}/main..HEAD`,
      this.outputChannel
    );
    if (gitLogInfos instanceof Error) {
      this.showErrorMessage({
        log: `Failed to detect commits in ${gitDir}`,
        metrics: 'FetchComments failed to detect commits',
      });
      return;
    }
    if (gitLogInfos.length === 0) {
      return;
    }

    const partitionedCommentThreads: [string, FilePathToCommentThreads][] = [];

    for (const gitLogInfo of gitLogInfos) {
      const changeId = gitLogInfo.changeId;
      const path = `changes/${changeId}/comments`;
      const commentsContent = await this.getOrThrow(repoId, path, authCookie);
      if (!commentsContent) {
        this.outputChannel.appendLine(`Not found on Gerrit: ${changeId}`);
        continue;
      }
      const commentInfosMap = JSON.parse(
        commentsContent
      ) as api.FilePathToCommentInfos;
      const combinedCommentThreadsMap = partitionCommentThreads(
        commentInfosMap,
        gitLogInfo
      );
      for (const item of partitionByCommitId(combinedCommentThreadsMap)) {
        partitionedCommentThreads.push(item);
      }
    }

    this.partitionedCommentThreads = partitionedCommentThreads;
  }

  /**
   * Gets a raw string from Gerrit REST API with an auth cookie,
   * returning undefined on 404 error
   */
  async getOrThrow(
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

  /** Reads gitcookies or returns undefined. */
  async readAuthCookie(): Promise<string | undefined> {
    const filePath = await auth.getGitcookiesPath(this.outputChannel);
    try {
      const str = await fs.readFile(filePath, {encoding: 'utf8'});
      return auth.parseGitcookies(str);
    } catch (err) {
      if ((err as {code?: unknown}).code === 'ENOENT') {
        const msg =
          'The gitcookies file for Gerrit auth was not found at ' + filePath;
        this.showErrorMessage(msg);
      } else {
        let msg =
          'Unknown error in reading the gitcookies file for Gerrit auth at ' +
          filePath;
        if (err instanceof Object) msg += ': ' + err.toString();
        this.showErrorMessage(msg);
      }
    }
  }

  /** Returns Git commit ids which are available in the local repo. */
  private async filterLocalCommitIds(
    allCommitIds: string[],
    gitDir: string
  ): Promise<string[]> {
    const local = [];
    for (const commitId of allCommitIds) {
      const commitExists = await this.checkCommitExists(commitId, gitDir);
      if (commitExists) local.push(commitId);
    }
    return local;
  }

  /**
   * Returns true if it check that the commit exists locally,
   * or returns false otherwise showing an error message
   */
  private async checkCommitExists(
    commitId: string,
    gitDir: string
  ): Promise<boolean> {
    const commitExists = await git.commitExists(
      commitId,
      gitDir,
      this.outputChannel
    );
    if (commitExists instanceof Error) {
      this.showErrorMessage({
        log: `Local availability check failed for the patchset ${commitId}.`,
        metrics: 'Local commit availability check failed',
      });
      return false;
    }
    if (!commitExists) {
      this.showErrorMessage({
        log:
          `The patchset ${commitId} was not available locally. This happens ` +
          'when some patchsets were uploaded to Gerrit from a different chroot.',
        metrics: 'commit not available locally',
      });
    }
    return commitExists;
  }

  /**
   * Updates line numbers in `commentThreadsMap`, which are assumed to be made
   * on the `originalCommitId`, so they can be placed in the right lines on the files
   * in the working tree.
   */
  async shiftCommentThreadsMap(
    gitDir: string,
    commitId: string,
    commentThreadsMap: FilePathToCommentThreads
  ): Promise<void> {
    // If the local branch is rebased after uploading it for review,
    // unrestricted `git diff` will include everything that changed
    // in the entire repo. This can have performance implications.
    const filePaths = Object.getOwnPropertyNames(commentThreadsMap).filter(
      filePath => !api.MAGIC_PATHS.includes(filePath)
    );
    const hunksMap = await git.readDiffHunks(
      gitDir,
      commitId,
      filePaths,
      this.outputChannel
    );
    if (hunksMap instanceof Error) {
      this.showErrorMessage(
        'Failed to get git diff to reposition Gerrit comments'
      );
      return;
    }
    shiftCommentThreadsByHunks(hunksMap, commentThreadsMap);
  }

  /**
   * Show `message.log` in the IDE, set task status to error,
   * and send `message.metrics` via metrics if it is set.
   *
   * If `message` is a string, it is used both in the log and metrics.
   */
  private showErrorMessage(message: string | {log: string; metrics?: string}) {
    const m: {log: string; metrics?: string} =
      typeof message === 'string' ? {log: message, metrics: message} : message;

    this.outputChannel.appendLine(m.log);
    this.statusManager.setStatus(GERRIT, bgTaskStatus.TaskStatus.ERROR);
    if (m.metrics) {
      metrics.send({
        category: 'error',
        group: 'gerrit',
        description: m.metrics,
      });
    }
  }

  clearVscodeCommentThreads() {
    this.vscodeCommentThreads.forEach(t => t.dispose());
    this.vscodeCommentThreads.length = 0;
  }

  private displayCommentThreads(
    controller: vscode.CommentController,
    commentThreadsMap: FilePathToCommentThreads,
    gitDir: string
  ) {
    for (const [filePath, commentThreads] of Object.entries(
      commentThreadsMap
    )) {
      commentThreads.forEach(commentThread => {
        let uri;
        if (filePath === '/COMMIT_MSG') {
          uri = gitDocument.commitMessageUri(
            gitDir,
            commentThread.gitLogInfo.localCommitId,
            'gerrit commit msg'
          );
          // Compensate the difference between commit message on Gerrit and Terminal
          if (
            commentThread.originalLine !== undefined &&
            commentThread.originalLine > 6
          ) {
            commentThread.shift -= 6;
          } else if (commentThread.originalLine !== undefined) {
            commentThread.shift -= commentThread.originalLine - 1;
          }
        } else if (filePath === '/PATCHSET_LEVEL') {
          uri = virtualDocument.patchSetUri(
            gitDir,
            commentThread.gitLogInfo.changeId
          );
        } else {
          uri = vscode.Uri.file(path.join(gitDir, filePath));
        }
        const vscodeThread = commentThread.displayForVscode(controller, uri);
        if (vscodeThread) {
          this.vscodeCommentThreads.push(vscodeThread);
        }
      });
    }
  }
}

function partitionCommentArray(
  apiCommentInfos: readonly api.CommentInfo[],
  gitLogInfo: git.GitLogInfo
): CommentThread[] {
  // Copy the input to avoid modifying data received from Gerrit API.
  const commentInfos = [...apiCommentInfos];

  // Sort the input to make sure we see ids before they are used in in_reply_to.
  commentInfos.sort((c1, c2) => c1.updated.localeCompare(c2.updated));

  const idxMap = new Map<string, number>();
  const commentThreads: CommentThread[] = [];

  for (const commentInfo of commentInfos) {
    // Idx is undefined for the first comment in a thread,
    // and for a reply to a comment we haven't seen.
    // The second case should not happen.
    let idx = commentInfo.in_reply_to
      ? idxMap.get(commentInfo.in_reply_to)
      : undefined;
    if (idx !== undefined) {
      commentThreads[idx].commentInfos.push(commentInfo);
    } else {
      // push() returns the new length of the modiified array
      idx =
        commentThreads.push(new CommentThread([commentInfo], gitLogInfo)) - 1;
    }
    idxMap.set(commentInfo.id, idx);
  }

  return commentThreads;
}

/**
 * For each filePath break comments in to comment threads. That is, turn a comment array
 * into an array of arrays, which represent comment threads
 */
function partitionCommentThreads(
  commentInfosMap: api.FilePathToCommentInfos,
  gitLogInfo: git.GitLogInfo
): FilePathToCommentThreads {
  const commentThreadsMap: FilePathToCommentThreads = {};
  for (const [filePath, commentInfos] of Object.entries(commentInfosMap)) {
    commentThreadsMap[filePath] = partitionCommentArray(
      commentInfos,
      gitLogInfo
    );
  }
  return commentThreadsMap;
}

function partitionByCommitId(
  commentThreadsMap: FilePathToCommentThreads
): [string, FilePathToCommentThreads][] {
  const map = helpers.splitPathArrayMap(commentThreadsMap, (t: CommentThread) =>
    t.commitId()
  );
  return [...map.entries()];
}

/**
 * Repositions comment threads based on the given hunks.
 *
 * Thread position is determined by its first comment,
 * so only the first comment is updated. The updates are in-place.
 */
export function shiftCommentThreadsByHunks(
  hunksAllFiles: git.FilePathToHunks,
  commentThreadsMap: FilePathToCommentThreads
) {
  for (const [filePath, commentThreads] of Object.entries(commentThreadsMap)) {
    const hunks = hunksAllFiles[filePath] || [];
    for (const commentThread of commentThreads) {
      commentThread.shift = 0;
      for (const hunk of hunks) {
        if (threadFollowsHunk(commentThread, hunk)) {
          // comment outside the hunk
          commentThread.shift += hunk.sizeDelta;
        } else if (
          // comment within the hunk
          threadWithinRange(commentThread, hunk.originalStart, hunk.originalEnd)
        ) {
          // Ensure the comment within the hunk still resides in the
          // hunk. If the hunk removes all the lines, the comment will
          // be moved to the line preceding the hunk.
          if (hunk.sizeDelta < 0 && commentThread.originalLine !== undefined) {
            const protrusion =
              commentThread.originalLine -
              (hunk.originalStart + hunk.currentSize) +
              1;
            if (protrusion > 0) {
              commentThread.shift -= protrusion;
            }
          }
        }
      }
      // Make sure we do not shift comments before the first line
      // because it causes errors (lines beyond the end of file are fine though).
      //
      // Note, that line numbers are 1-based. The code that shifts comments within
      // deleted hunks may put comments on line 0 (we use `<=` in case of unknown bugs),
      // so we adjust `shift` so that `originalLine + shift == 1`.
      if (
        commentThread.originalLine &&
        commentThread.originalLine + commentThread.shift <= 0
      ) {
        commentThread.shift = -(commentThread.originalLine - 1);
      }
    }
  }
}

/**
 * True if a thread starts after the hunk ends. Such threads should be moved
 * by the size change introduced by the hunk.
 */
function threadFollowsHunk(commentThread: CommentThread, hunk: git.Hunk) {
  if (!commentThread.originalLine) {
    return false;
  }

  // Case 1: hunks that insert lines.
  // The original side is `N,0` and the hunk inserts lines between N and N+1.
  if (hunk.originalSize === 0) {
    return commentThread.originalLine > hunk.originalStart;
  }

  // Case 2: Modifications and deletions.
  // The original side is `N,size` and the hunk modifies 'size' lines starting from N.
  return commentThread.originalLine >= hunk.originalStart + hunk.originalSize;
}

/**
 * Returns whether the comment is in the range between
 * minimum (inclusive) and maximum (exclusive).
 */
function threadWithinRange(
  commentThread: CommentThread,
  minimum: number,
  maximum: number
): boolean {
  return (
    commentThread.originalLine !== undefined &&
    commentThread.originalLine >= minimum &&
    commentThread.originalLine < maximum
  );
}

export class CommentThread {
  /**
   * Update required to reposition the thread from the original location
   * to the corresponding line in the working tree. Only lines are shifted,
   * columns are ignored.
   */
  shift = 0;

  vscodeCommentThread?: vscode.CommentThread;

  constructor(
    readonly commentInfos: api.CommentInfo[],
    readonly gitLogInfo: git.GitLogInfo
  ) {}

  get originalLine() {
    return this.commentInfos[0].line;
  }

  /** Shifted line. */
  get line() {
    if (!this.originalLine) {
      return undefined;
    }
    return this.originalLine + this.shift;
  }

  /** Shifted range. */
  get range() {
    const r = this.commentInfos[0].range!;
    if (!r) {
      return undefined;
    }
    return {
      start_line: r.start_line + this.shift,
      start_character: r.start_character,
      end_line: r.end_line + this.shift,
      end_character: r.end_character,
    };
  }

  commitId(): string {
    // TODO(b:216048068): make sure we have the commit_id
    return this.commentInfos[0].commit_id!;
  }

  /** A thread is unresolved if its last comment is unresolved. */
  get unresolved() {
    // Unresolved can be undefined according to the API documentation,
    // but Gerrit always sent it on the changes the we inspected.
    return this.commentInfos[this.commentInfos.length - 1].unresolved;
  }

  /** Shows the thread in the UI and returns vscode.CommentThread, if it was created. */
  displayForVscode(
    controller: vscode.CommentController,
    dataUri: vscode.Uri
  ): vscode.CommentThread | undefined {
    if (this.vscodeCommentThread) {
      this.vscodeCommentThread.range = getVscodeRange(this);
      return undefined;
    }
    this.vscodeCommentThread = createVscodeCommentThread(
      controller,
      this,
      dataUri
    );
    return this.vscodeCommentThread;
  }
}

/**
 * Like FilePathToCommentInfos, but the comments are partitioned
 * into comment threads represented as arrays of comments.
 */
export type FilePathToCommentThreads = {
  [filePath: string]: CommentThread[];
};

/**
 * Convert UTC timestamp returned by Gerrit into a localized human fiendly format.
 *
 * Sample input: '2022-09-27 09:25:04.000000000'
 */
function formatGerritTimestamp(timestamp: string) {
  try {
    // The input is UTC, but before we can parse it, we need to adjust
    // the format by replacing '.000000000' at the end with 'Z'
    // ('Z' tells date-fns that it's UTC time).
    const timestampZ: string = timestamp.replace(/\.[0-9]*$/, 'Z');
    const date: Date = dateFns.parse(
      timestampZ,
      'yyyy-MM-dd HH:mm:ssX',
      new Date()
    );
    // Date-fns functions use the local timezone.
    if (dateFns.isToday(date)) {
      return dateFns.format(date, 'HH:mm'); // e.g., 14:27
    } else if (dateFns.isThisYear(date)) {
      return dateFns.format(date, 'MMM d'); // e.g., Sep 5
    } else {
      return dateFns.format(date, 'yyyy MMM d'); // e.g., 2019 Aug 15
    }
  } catch (err) {
    // Make sure not to throw any errors, because then
    // the comments may not be shown at all.
    return timestamp;
  }
}

/**
 * Turn api.CommentInfo into vscode.Comment
 */
function toVscodeComment(c: api.CommentInfo): vscode.Comment {
  return {
    author: {
      name: api.accountName(c.author),
    },
    label: formatGerritTimestamp(c.updated),
    body: new vscode.MarkdownString(c.message),
    mode: vscode.CommentMode.Preview,
  };
}

function getVscodeRange(commentThread: CommentThread): vscode.Range {
  const range = commentThread.range;
  if (range !== undefined) {
    // VSCode is 0-base, whereas Gerrit has 1-based lines and 0-based columns.
    return new vscode.Range(
      range.start_line - 1,
      range.start_character,
      range.end_line - 1,
      range.end_character
    );
  }

  // comments for a line
  const line = commentThread.line;
  if (line !== undefined) {
    return new vscode.Range(line - 1, 0, line - 1, 0);
  }

  // comments for the entire file
  return new vscode.Range(0, 0, 0, 0);
}

function createVscodeCommentThread(
  controller: vscode.CommentController,
  commentThread: CommentThread,
  dataUri: vscode.Uri
): vscode.CommentThread {
  const vscodeThread = controller.createCommentThread(
    dataUri,
    getVscodeRange(commentThread),
    commentThread.commentInfos.map(c => toVscodeComment(c))
  );
  // TODO(b:216048068): We should indicate resolved/unresolved with UI style.
  if (commentThread.unresolved) {
    vscodeThread.label = 'Unresolved';
    vscodeThread.collapsibleState =
      vscode.CommentThreadCollapsibleState.Expanded;
  } else {
    vscodeThread.label = 'Resolved';
  }
  vscodeThread.canReply = false;
  return vscodeThread;
}

export const TEST_ONLY = {
  formatGerritTimestamp,
  Gerrit,
  partitionCommentThreads,
};
