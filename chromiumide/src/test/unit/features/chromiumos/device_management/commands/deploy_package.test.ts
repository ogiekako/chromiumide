// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as vscode from 'vscode';
import {LruCache} from '../../../../../../common/lru_cache';
import {Package} from '../../../../../../features/chromiumos/boards_and_packages/package';
import * as deployPackages from '../../../../../../features/device_management/commands/deploy_package';
import * as testing from '../../../../../testing';
import {FakeQuickPick} from '../../../../../testing/fakes/quick_pick';

const PACKAGES_LIST = [
  {
    category: 'chromeos-base',
    name: 'codelab',
    workon: 'started' as const,
  },
];
const PACKAGE_FULL_NAME = 'chromeos-base/codelab';

const PACKAGES_LIST_NEW = [
  {
    category: 'chromeos-base',
    name: 'codelab-new',
    workon: 'stopped' as const,
  },
];
const PACKAGE_FULL_NAME_NEW = 'chromeos-base/codelab-new';

describe('Prompt target package', () => {
  const {vscodeSpy, vscodeEmitters} = testing.installVscodeDouble();
  testing.installFakeConfigs(vscodeSpy, vscodeEmitters);

  const state = testing.cleanState(async () => {
    const onDidChangePickerItems = new vscode.EventEmitter<
      readonly vscode.QuickPickItem[]
    >();
    const state = {
      picker: new FakeQuickPick(),
      onDidChangePickerItems,
      onDidChangePickerItemsReader: new testing.EventReader(
        onDidChangePickerItems.event
      ),
    };

    vscodeSpy.window.createQuickPick.and.returnValue(state.picker);
    return state;
  });

  afterEach(() => {
    state.onDidChangePickerItemsReader.dispose();
    state.onDidChangePickerItems.dispose();
  });

  it('without cache', async () => {
    expect(state.picker.items).toEqual([]);

    const boardToPackages = new LruCache<string, Package[]>(10);
    const gettingTargetPackage = deployPackages.promptTargetPackageWithCache(
      'betty',
      boardToPackages,
      async () => PACKAGES_LIST,
      state.onDidChangePickerItems
    );

    // There is no cached list of packages for the board and the onDidChangePickerItems event is
    // only fired once (when loading the list).
    await state.onDidChangePickerItemsReader.read().then(items =>
      expect(items).toEqual([
        jasmine.objectContaining({
          label: PACKAGE_FULL_NAME,
          description: '(workon)',
        }),
      ])
    );

    state.picker.activeItems = [{label: PACKAGE_FULL_NAME}];
    state.picker.accept();

    expect(await gettingTargetPackage).toEqual(PACKAGE_FULL_NAME);
  });

  it('with up-to-date cache', async () => {
    expect(state.picker.items).toEqual([]);

    const boardToPackages = new LruCache<string, Package[]>(10);
    boardToPackages.set('betty', PACKAGES_LIST);

    const gettingTargetPackage = deployPackages.promptTargetPackageWithCache(
      'betty',
      boardToPackages,
      async () => PACKAGES_LIST,
      state.onDidChangePickerItems
    );

    // First time when items is set as the cached list of packages.
    await state.onDidChangePickerItemsReader.read().then(items =>
      expect(items).toEqual([
        jasmine.objectContaining({
          label: PACKAGE_FULL_NAME,
          description: '(workon)',
        }),
      ])
    );

    // Second time when list of packages is reloaded but remained the same.
    await state.onDidChangePickerItemsReader.read().then(items =>
      expect(items).toEqual([
        jasmine.objectContaining({
          label: PACKAGE_FULL_NAME,
          description: '(workon)',
        }),
      ])
    );

    state.picker.activeItems = [{label: PACKAGE_FULL_NAME}];
    state.picker.accept();

    expect(await gettingTargetPackage).toEqual(PACKAGE_FULL_NAME);
  });

  it('with outdated cache', async () => {
    expect(state.picker.items).toEqual([]);

    const boardToPackages = new LruCache<string, Package[]>(10);
    boardToPackages.set('betty', PACKAGES_LIST);

    const gettingTargetPackage = deployPackages.promptTargetPackageWithCache(
      'betty',
      boardToPackages,
      async () => PACKAGES_LIST_NEW,
      state.onDidChangePickerItems
    );

    // First time when items is set as the cached list of packages with a cros-workon stopped package.
    await state.onDidChangePickerItemsReader.read().then(items =>
      expect(items).toEqual([
        jasmine.objectContaining({
          label: PACKAGE_FULL_NAME,
          description: '(workon)',
        }),
      ])
    );

    // Second time when list of packages is reloaded and package becomes workon started.
    await state.onDidChangePickerItemsReader.read().then(items =>
      expect(items).toEqual([
        jasmine.objectContaining({
          label: PACKAGE_FULL_NAME_NEW,
          description: undefined,
        }),
      ])
    );

    state.picker.activeItems = [{label: PACKAGE_FULL_NAME_NEW}];
    state.picker.accept();

    expect(await gettingTargetPackage).toEqual(PACKAGE_FULL_NAME_NEW);
  });
});
