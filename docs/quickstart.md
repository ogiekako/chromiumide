# CrOS IDE quickstart (go/cros-ide-quickstart)

CrOS IDE is a VS Code Extension for Chrome OS development. It is a new project,
and we currently support only internal developers at Google.

## Prerequisites

All you need is a Chrome OS chroot, which most developers already have.
If you don't have it, please follow the [Chromium OS Developer Guide] and set up
your development environment, so you can [enter the chroot via cros_sdk].

[Chromium OS Developer Guide]: https://chromium.googlesource.com/chromiumos/docs/+/HEAD/developer_guide.md
[enter the chroot via cros_sdk]: https://chromium.googlesource.com/chromiumos/docs/+/HEAD/developer_guide.md#Enter-the-chroot

## 1. Install Visual Studio Code

First, you need to install Visual Studio on your client machine.

### gLinux
```
sudo apt install code
```
Learn more at [go/vscode/install#glinux]

[go/vscode/install#glinux]: http://go/vscode/install#glinux

### gMac
Install [VS Code from the Software Center] or [go/mule]
(`sudo mule install visual-studio-code`).

[VS Code from the Software Center]: https://device-portal.corp.google.com/#/software-center/list//appid%3AMAC_OS-visual-studio-code/MAC_OS
[go/mule]: http://go/mule

### Chrome OS

CrOS IDE supports only platform-specific VS Code, which is not available for
Chrome OS. There are two workarounds:
- Check out [go/cros-ide-on-chromebooks] to learn more about
  [Code Server], which is a Web IDE accessible in the browser.
- Use remote desktop.

[go/cros-ide-on-chromebooks]: http://go/cros-ide-on-chromebooks
[Code Server]: https://github.com/coder/code-server

## 2. Install cros-sdk-proxy

Follow [cros-sdk-proxy documentation](../cros-sdk-proxy/README.md).

Verify the installation by running the following command on your client machine:
```
ssh cros
```
It should connect to the chroot, just like `cros_sdk` does.

## 3. Connect to chroot via VSCode

Install [Remote development] extension on the VSCode.
Select SSH target `cros` and open your working directory under
`/home/$USER/chromiumos/`.

[Remote development]: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack

## 4. Install the extension

Open terminal in the VSCode connected to `cros`, and run

```
~/chromiumos/chromite/ide_tooling/cros-ide/install.sh
```

### Additional installation options

* In case you are using code-server or VS Code Insiders, specify the VS Code executable with
  `--exe` flag. For example

```
~/chromiumos/chromite/ide_tooling/cros-ide/install.sh --exe ~/.local/bin/code-server
```

* You can install an old version of extension (say 0.0.1), with `--force 0.0.1` flag.

## 5. Reload the IDE

You need to reload the VS Code to activate the extension. Either simply restart
the IDE, or open the command palette (Ctrl+Shift+P) and type "Developer: Reload
Window".
