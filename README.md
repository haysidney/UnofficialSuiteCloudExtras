# Unofficial SuiteCloud Extras for VS Code

Adds features that are missing from the [SuiteCloud Extension for Visual Studio Code](https://github.com/oracle/netsuite-suitecloud-sdk/tree/master/packages/vscode-extension).

## Features

- Compare Local File with FileCabinet Copy.

## Requirements

- [JDK 11](https://www.oracle.com/java/technologies/downloads/#java11)
- [Node.js LTS](https://nodejs.org/en/download/)
- [SuiteCloud CLI for Node.js](https://netsuite.custhelp.com/app/answers/detail/a_id/91799)
   * npm install -g @oracle/suitecloud-cli

## Installation

- Install the requirements from above (and make sure they're up to date!)
- Go to [Releases](https://github.com/haysidney/UnofficialSuiteCloudExtras/releases) and install the VSIX file in VS Code via Extensions -> Install from VSIX...
- In an Admin PowerShell prompt, run: (if you haven't already)
  * Set-ExecutionPolicy RemoteSigned

## Release Notes
### v0.9.1

Fixed a bug where files would have .bak appended to them if an error occurred when running the SuiteCloud CLI.

### v0.9.0

Initial beta of Unofficial SuiteCloud Extras.
