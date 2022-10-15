// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as path from 'path';
import * as vscode from 'vscode';
import * as commonUtil from '../../../../common/common_util';
import * as api from '../../../../features/gerrit/api';
import {TEST_ONLY} from '../../../../features/gerrit/gerrit';
import * as https from '../../../../features/gerrit/https';
import * as testing from '../../../testing';

const {formatGerritTimestamp, Gerrit, partitionThreads} = TEST_ONLY;

describe('partitionThreads', () => {
  type CommentInfoLike = Pick<
    api.CommentInfo,
    'id' | 'updated' | 'in_reply_to'
  >;

  it('breaks threads', () => {
    const zeroTime = ' 00:00:00.000000000';
    const comments: CommentInfoLike[] = [
      {
        id: 'reply_1_1',
        in_reply_to: 'thread_1',
        updated: '2022-09-10' + zeroTime,
      },
      {
        id: 'reply_1_2',
        in_reply_to: 'reply_1_1',
        updated: '2022-09-20' + zeroTime,
      },
      {
        id: 'thread_1',
        updated: '2022-09-01' + zeroTime,
      },

      {id: 'thread_2', updated: '2022-09-05' + zeroTime},
      {id: 'thread_3', updated: '2022-09-07' + zeroTime},
      {
        id: 'reply_3_1',
        in_reply_to: 'thread_3',
        updated: '2022-09-08' + zeroTime,
      },
      {
        id: 'reply_to_nonexisting',
        in_reply_to: 'does_not_exist',
        updated: '2022-09-30' + zeroTime,
      },
    ];
    const input = {
      'file/path.cc': comments.map(c => c as api.CommentInfo),
    };

    const oc = jasmine.objectContaining;
    const want = {
      'file/path.cc': [
        [oc({id: 'thread_1'}), oc({id: 'reply_1_1'}), oc({id: 'reply_1_2'})],
        [oc({id: 'thread_2'})],
        [oc({id: 'thread_3'}), oc({id: 'reply_3_1'})],
        [oc({id: 'reply_to_nonexisting'})],
      ],
    };

    expect(partitionThreads(input)).toEqual(want);
  });
});

describe('formatGerritTimestaps', () => {
  const now = new Date();

  const year = now.getUTCFullYear().toString();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dayNoPadding = now.getUTCDate().toString();
  const day = dayNoPadding.padStart(2, '0');
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');

  it("formats today's date as hours and minutes", () => {
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:04.000000000`;
    // We don't know the local timezone, only match the regex.
    expect(formatGerritTimestamp(timestamp)).toMatch(/[0-9]{2}:[0-9]{2}/);
  });

  it("formats this year's dates as month and day", () => {
    const month = (((now.getUTCMonth() + 1) % 12) + 1)
      .toString()
      .padStart(2, '0');
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:04.000000000`;
    // Test only the day, because month name could be localized.
    expect(formatGerritTimestamp(timestamp)).toContain(dayNoPadding);
  });

  it('formats dates long time ago as year, month, and day', () => {
    // Test only the year, because month name could be localized
    // and the day may depend on the timezone
    expect(formatGerritTimestamp('2018-09-27 09:25:04.000000000')).toMatch(
      /^2018/
    );
  });

  it('does not crash on malformed input', () => {
    const badTimestamp = 'last Monday';
    expect(formatGerritTimestamp(badTimestamp)).toEqual(badTimestamp);
  });
});

// From crrev.com/c/3951631
// JSON was simplified by leaving out some avatars, leading )]}\n was preserved
const SIMPLE_COMMENT_GERRIT_JSON = (commitId1: string) => `)]}
{
  "cryptohome/cryptohome.cc": [
    {
      "author": {
        "_account_id": 1355869,
        "name": "Tomasz Tylenda",
        "email": "ttylenda@chromium.org",
        "avatars": [
          {
            "url": "https://lh3.googleusercontent.com/-9a8_POyNIEg/AAAAAAAAAAI/AAAAAAAAAAA/XD1eDsycuww/s32-p/photo.jpg",
            "height": 32
          }
        ]
      },
      "change_message_id": "592dcb09ed96952012e147fe621d264db460cd6f",
      "unresolved": true,
      "patch_set": 1,
      "id": "b2698729_8e2b9e9a",
      "line": 3,
      "updated": "2022-10-13 05:27:40.000000000",
      "message": "Unresolved comment on the added line.",
      "commit_id": "${commitId1}"
    }
  ]
}
`;

//TODO(b:253536935): Move Git functions to a common location.

async function gitInit(root: string) {
  await commonUtil.execOrThrow('git', ['init'], {cwd: root});
}

async function gitAddAll(root: string) {
  await commonUtil.execOrThrow('git', ['add', '.'], {cwd: root});
}

function cond(test: boolean | undefined, value: string): string[] {
  return test ? [value] : [];
}

async function gitCheckout(
  root: string,
  name: string,
  opts?: {createBranch?: boolean}
) {
  const args = ['checkout', ...cond(opts?.createBranch, '-b'), name];
  await commonUtil.execOrThrow('git', args, {cwd: root});
}

async function gitCommit(root: string, message: string): Promise<string> {
  await commonUtil.execOrThrow(
    'git',
    ['commit', '--allow-empty', '-m', message],
    {
      cwd: root,
    }
  );
  return (
    await commonUtil.execOrThrow('git', ['rev-parse', 'HEAD'], {cwd: root})
  ).stdout.trim();
}

describe('Gerrit', () => {
  const tempDir = testing.tempDir();

  it('displays a comment', async () => {
    const root = tempDir.path;
    const abs = (relative: string) => path.join(root, relative);

    // Create a repo with two commits:
    //   1) The first simulates cros/main.
    //   2) The second is the commit on which Gerrit review is taking place.
    await gitInit(root);
    await gitCommit(root, 'First');
    await gitCheckout(root, 'cros/main', {createBranch: true});
    await gitCheckout(root, 'main');
    await testing.putFiles(root, {
      'cryptohome/cryptohome.cc': 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n',
    });
    await gitAddAll(root);
    const commitId = await gitCommit(
      root,
      'Second\nChange-Id: I23f50ecfe44ee28972aa640e1fa82ceabcc706a8'
    );

    // We verify that the comments were shown by verifying interactions
    // with commentController.
    const commentController = jasmine.createSpyObj<vscode.CommentController>(
      'commentController',
      ['createCommentThread']
    );

    // Without it we get an error setting fields on an undefined object,
    // which causes flakiness.
    commentController.createCommentThread.and.returnValue(
      {} as vscode.CommentThread
    );

    const gerrit = new Gerrit(
      commentController,
      vscode.window.createOutputChannel('gerrit')
    );

    const document = {
      fileName: abs('cryptohome/cryptohome.cc'),
    } as vscode.TextDocument;

    spyOn(https, 'get')
      .withArgs(
        'https://chromium-review.googlesource.com/changes/I23f50ecfe44ee28972aa640e1fa82ceabcc706a8/comments'
      )
      .and.returnValue(Promise.resolve(SIMPLE_COMMENT_GERRIT_JSON(commitId)));

    await expectAsync(gerrit.showComments(document)).toBeResolved();

    expect(commentController.createCommentThread).toHaveBeenCalledTimes(1);
    const callData = commentController.createCommentThread.calls.first();
    expect(callData.args[0].fsPath).toEqual(abs('cryptohome/cryptohome.cc'));
    expect(callData.args[1].start.line).toEqual(2);
    expect(callData.args[2][0].body).toEqual(
      'Unresolved comment on the added line.'
    );
  });
});
