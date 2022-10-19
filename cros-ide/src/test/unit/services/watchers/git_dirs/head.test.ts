// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {Watcher} from '../../../../../services/watchers/git_dirs/head';
import * as testing from '../../../../testing';

describe('git.Watcher', () => {
  const tempDir = testing.tempDir();

  const subscriptions: vscode.Disposable[] = [];
  afterEach(() => {
    vscode.Disposable.from(...subscriptions.reverse()).dispose();
    subscriptions.splice(0);
  });

  it('emits events on right timing', async () => {
    const root = tempDir.path;

    const git = new testing.Git(root);
    await git.init();
    // Create initial commit before creating a watcher, because it cannot handle
    // empty git repository.
    const firstHash = await git.commit('First commit');

    const watcher = new Watcher(root);
    subscriptions.push(watcher);

    const reader = new testing.EventReader(watcher.onDidChange);
    subscriptions.push(reader);

    expect(await reader.read()).toEqual({head: firstHash});

    const secondHash = await git.commit('Second commit');

    expect(await reader.read()).toEqual({head: secondHash});

    const thirdHash = await git.commit('Third commit');

    expect(await reader.read()).toEqual({head: thirdHash});

    await git.checkout('HEAD~');

    expect(await reader.read()).toEqual({head: secondHash});
  });
});
