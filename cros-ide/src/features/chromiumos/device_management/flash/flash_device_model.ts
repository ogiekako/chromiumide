// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export type FlashDeviceViewState = {
  readonly step: FlashDeviceStep;
  readonly buildSelectionType: BuildSelectionType;
  readonly hostname: string;
  readonly board: string;
  readonly buildChannel: BuildChannel;
  readonly buildInfo?: BuildInfo;
  readonly flashFlags: Set<FlashFlag>;
  readonly flashProgress: number; // From 0.0 to 1.0
  readonly flashingComplete: boolean;
  readonly flashError: string;
};

export enum FlashDeviceStep {
  HIGH_LEVEL_BUILD_SELECTION,
  BUILD_BROWSER,
  FLASH_CONFIRMATION,
  FLASH_PROGRESS,
}

export enum BuildSelectionType {
  LATEST_OF_CHANNEL,
  SPECIFIC_BUILD,
  // LOCAL_CROS_REPO,
}

export enum BuildChannel {
  CANARY = 'canary',
  DEV = 'dev',
  BETA = 'beta',
  STABLE = 'stable',
}

export type FlashFlag = {
  readonly label: string;
  readonly cliFlag: string;
  readonly help: string;
};

export const FLASH_FLAGS: FlashFlag[] = [
  {
    label: "Don't reboot afterwards",
    cliFlag: '--no-reboot',
    help: '',
  },
];

export type BuildInfo = {
  readonly chromeVersion: string;
  readonly chromeMilestone: string;
  readonly chromeOsVersion: string;
  readonly arcVersion: string;
  readonly arcBranch: string;
  readonly buildChannel: BuildChannel;
  readonly date: Date;
};

export interface CloseMessage {
  command: 'close';
}

export interface FlashMessage {
  command: 'flash';
  state: FlashDeviceViewState;
}

/** Messages from the view to the panel controller. */
export type FlashDeviceViewMessage = CloseMessage | FlashMessage;

export interface FlashProgressUpdate {
  command: 'flashProgressUpdate';

  /** Progress from 0.0 to 1.0 inclusively. */
  progress: number;
}

export interface FlashComplete {
  command: 'flashComplete';
}

export interface FlashError {
  command: 'flashError';
  errorMessage: string;
}

/** Messages from the panel controller to the view.  */
export type FlashDevicePanelMessage =
  | FlashProgressUpdate
  | FlashComplete
  | FlashError;
