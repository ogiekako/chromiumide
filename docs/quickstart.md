# ChromiumIDE quickstart (go/chromiumide-quickstart)

ChromiumIDE (formerly known as CrOS IDE) is a VSCode Extension for Chromium and
ChromiumOS development. We currently support only internal developers at Google.

See [go/chromiumide] for our internal landing page.

[go/chromiumide]: http://go/chromiumide

# Guide for _external developers_

**Googlers should read [go/chromiumide] instead**

What follows is the guide for curious _external developers_. Note that we can't guarantee the
extension to work in external environment, and our support for that is as-is basis.

## Prerequisites (ChromiumOS)

For developing ChromiumOS, you need a ChromiumOS chroot. If you are a new member
and don't have it, please follow the [ChromiumOS Developer Guide] and set up
your development environment, so you can [enter the chroot via cros_sdk].

In this document, we assume ChromiumOS source code is in `~/chromiumos`.

[chromiumos developer guide]: https://chromium.googlesource.com/chromiumos/docs/+/HEAD/developer_guide.md
[enter the chroot via cros_sdk]: https://chromium.googlesource.com/chromiumos/docs/+/HEAD/developer_guide.md#Enter-the-chroot

## 1. Install Visual Studio Code

First, you need to install Visual Studio Code (VSCode) on your machine.

## 2. (Optional) Connect to your machine via VSCode

If you use remote setup, for example gMac laptop, you will need
[Remote development] extension.

Install [Remote development] extension on the VSCode. Click the lower left "Open
a Remote Window" button and select \[Connect to Host...\] command (alternatively
directly choose this command from the command palette), select your remote
machine, and open your working directory under `~/chromiumos/`.

[remote development]: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack

## 3. Install the extension

Open _View &rarr; Extensions_ in VSCode (Ctrl+Shift+X), search [ChromiumIDE] and
install it.

[chromiumide]: https://marketplace.visualstudio.com/items?itemName=Google.cros-ide

## 4. Open a folder

Finally, open a folder with sources to let ChromiumIDE detect the chroot. Select
_File &rarr; Open Folder..._, choose, for example, `~/chromiumos/src/platform2`,
and you are good to go.

# Using ChromiumIDE

## Selected Features

### Code Completion and Navigation

Code completion in C++ is available in platform2 packages which support
`USE=compdb_only`. Press F12 to [Go to Definition], Ctrl+F12 to Go to
Implementation, and so on.

[go to definition]: https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition

### Device Management

ChromiumIDE provides a view to manage your test devices. With the built-in VNC
client, you can control a device remotely.

### Linter Integration

ChromiumIDE exposes lint errors found by `cros lint` and similar tools in C++,
Python, shell, and GN files. We run linters every time a file is saved, and mark
errors with squiggly lines in the editor and show them in the _Problems_ box and
on mouse hover. This feature brings to your attention errors which block `repo
upload`.

### Boards and Packages

ChromiumIDE shows which packages you are working on and lets you run `cros_workon
start/stop` directly from the UI. Access it by clicking on _CrOS Development_
[activity bar] (Chrome icon). Use +/– buttons to start and stop working on packages.

[activity bar]: https://code.visualstudio.com/docs/getstarted/userinterface

### Code Search

You can easily open the current file in Code Search from the context menu in a
text editor. Go to [settings] to choose whether to chose which instance to use
(public, internal, or Gitiles).

[settings]: https://code.visualstudio.com/docs/getstarted/settings
