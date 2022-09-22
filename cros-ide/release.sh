#!/bin/bash
# Copyright 2022 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -e

if [[ -z "${OVSX_PAT}" ]]; then
  echo "Set OpenVSX personal access token to OVSX_PAT: read https://github.com/eclipse/openvsx/wiki/Publishing-Extensions " 1>&2
  exit 1
fi

cd "$(dirname "$0")"

if [[ -n "$(git status -s)" ]]; then
  echo "Git status dirty: run the command in clean environment"
  exit 1
fi

# Assert HEAD is already merged, i.e. an ancestor of cros/main.
if ! git merge-base --is-ancestor HEAD cros/main; then
  echo "HEAD should be an ancestor of cros/main"
  exit 1
fi

if ! git diff -U0 -p HEAD~ -- ./package.json | grep '^\+.*"version"' --quiet
then
  echo "HEAD commit should update version in package.json"
  exit 1
fi

npx vsce package

filename="$(ls "*.vsix")"

echo "Publishing ${filename} to OpenVSX"

npx ovsx publish "${filename}" -p "${OVSX_PAT}"

echo "Done: https://open-vsx.org/extension/Google/cros-ide"

echo "**IMPORTANT** Please manually publish the extension ${filename} to the MS Marketplace https://marketplace.visualstudio.com/manage/publishers/google ."
