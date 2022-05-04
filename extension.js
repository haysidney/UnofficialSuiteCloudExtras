// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');

const compareFileWithFileCabinetBeginMessage = 'Downloading file from NetSuite...';

const suiteCloudImportSuccessPattern = 'The following files were imported:';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('unofficial-suitecloud-extras.compareFileWithFileCabinet', () => { compareFileWithFileCabinet(context) }));
}

async function compareFileWithFileCabinet (context) {
	// TODO Add a setting for showing the Terminal.
	// TODO If said setting is hiding the terminal, then we'll show the following.
	vscode.window.showInformationMessage(compareFileWithFileCabinetBeginMessage);

	await vscode.window.activeTextEditor.document.save();

	let currentFileUri = vscode.window.activeTextEditor.document.uri;
	let currentFilePath = currentFileUri.path;
	let currentFileExtension = path.extname(currentFilePath);
	let fileCabinetFilePath = currentFilePath.split('/FileCabinet').pop();

	let currentFileBackupPath = currentFilePath + '.bak';
	let currentFileBackupUri = vscode.Uri.file(currentFileBackupPath);

	let tempFilePath = currentFilePath.replace(currentFileExtension, '_' + Date.now() + currentFileExtension);
	let tempFileUri = vscode.Uri.file(tempFilePath);

	// Rename to .bak because SuiteCloud CLI would overwrite it otherwise.
	await vscode.workspace.fs.rename(currentFileUri, currentFileBackupUri);

	let terminal = vscode.window.createTerminal({
		name: 'FileCabinet Compare...',
		message: compareFileWithFileCabinetBeginMessage + '\n',
		// TODO NoLogo doesn't seem to be working here for some reason.
		shellArgs: ['-NoLogo'],
		isTransient: true
	});

	// TODO Add a setting for showing the Terminal.
	terminal.show(true);

	const suiteCloudCommand = `suitecloud file:import --paths "${fileCabinetFilePath}" --excludeproperties`;
	const errorCheckCommand = `if ($__ | Select-String -Pattern "${suiteCloudImportSuccessPattern}" -quiet) {exit 0} else {pause; exit 1}`;
	const finalCommand = `clear; ${suiteCloudCommand} | Write-Output -OutVariable __; ${errorCheckCommand}`;

	terminal.sendText(finalCommand);

	// Callback for when SuiteCloud CLI is done running.
	const tempOnDidCloseTerminal = vscode.window.onDidCloseTerminal(async (closedTerminal) => {
		if (terminal == closedTerminal) {
			if (closedTerminal.exitStatus && closedTerminal.exitStatus.code) {
				vscode.window.showErrorMessage('Something went wrong when trying to download the file. Exit Code: ' + terminal.exitStatus.code);

				// Rename our backup of our local copy back to what it was before.
				await vscode.workspace.fs.rename(currentFileBackupUri, currentFileUri);
			}
			else {
				// Rename the FileCabinet version of the file to a temp filename.
				await vscode.workspace.fs.rename(currentFileUri, tempFileUri);
				// Rename our backup of our local copy back to what it was before.
				await vscode.workspace.fs.rename(currentFileBackupUri, currentFileUri);

				// Kick off a VS Code diff of the two files.
				vscode.commands.executeCommand("vscode.diff", currentFileUri, tempFileUri, '[DIFF] ' + path.basename(currentFileUri.path), {preview: true});

				// Set up callback to delete the temp file when it's no longer being viewed.
				const tempOnDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument((textDocument) => {
					if (textDocument.uri.path == tempFileUri.path) {
						vscode.workspace.fs.delete(textDocument.uri);
			
						// We want this event handler to dispose of itself.
						tempOnDidCloseTextDocument.dispose();
					}
				});
				// Add the disposable just in case it never fires
				context.subscriptions.push(tempOnDidCloseTextDocument);
			}
			
			// We want this event handler to dispose of itself.
			tempOnDidCloseTerminal.dispose();
		}
	});
	// Add the disposable just in case it never fires
	context.subscriptions.push(tempOnDidCloseTerminal);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
