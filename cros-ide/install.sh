#!/bin/bash
# Copyright 2022 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

terminal_color_clear='\033[0m'
terminal_color_warning='\033[1;31m'
min_node_ver=v14

echoWarning() {
  printf "${terminal_color_warning}%s${terminal_color_clear}\n" "$1"
}

cd "$(dirname "$0")" || exit 1

if [[ $(node --version) != ${min_node_ver}* ]]; then
  echoWarning "Node version is too low. Please run\
  '~/chromiumos/src/scripts/update_chroot' to get node\
  ${min_node_ver} or higher to avoid unexpected issues."
fi

npm ci || exit $?
npx ts-node ./src/tools/install.ts "$@"
