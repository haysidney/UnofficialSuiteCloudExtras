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
	context.subscriptions.push(vscode.commands.registerCommand('unofficial-suitecloud-extras.compareFileWithFileCabinet', () => {compareFileWithFileCabinet(context);}));
}

function compareFileWithFileCabinet (context) {
	// TODO Add a setting for showing the Terminal.
	// TODO If said setting is hiding the terminal, then we'll show the following.
	vscode.window.showInformationMessage(compareFileWithFileCabinetBeginMessage);

	vscode.window.activeTextEditor.document.save().then(() => {
		let currentFileUri = vscode.window.activeTextEditor.document.uri;
		let currentFilePath = currentFileUri.path;
		let currentFileExtension = path.extname(currentFilePath);
		let tempFilePath = currentFilePath.replace(currentFileExtension, '_' + Date.now() + currentFileExtension);
		let tempFileUri = vscode.Uri.file(tempFilePath);
		let fileCabinetFilePath = currentFilePath.split('/FileCabinet').pop();

		vscode.workspace.fs.copy(currentFileUri, tempFileUri).then(() => {
			const tempOnDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument((textDocument) => {
				if (textDocument.uri.path == tempFileUri.path) {
					vscode.workspace.fs.delete(textDocument.uri);

					// We want this event handler to dispose of itself.
					tempOnDidCloseTextDocument.dispose();
				}
			});
			// Add the disposable just in case it never fires
			context.subscriptions.push(tempOnDidCloseTextDocument);

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

			const tempOnDidCloseTerminal = vscode.window.onDidCloseTerminal((closedTerminal) => {
				if (terminal == closedTerminal) {
					console.log(closedTerminal.exitStatus);
					if (closedTerminal.exitStatus && closedTerminal.exitStatus.code)
					vscode.window.showErrorMessage('Something went wrong when trying to download the file. Exit Code: ' + terminal.exitStatus.code);
					else
					vscode.commands.executeCommand("vscode.diff", currentFileUri, tempFileUri, undefined, {preview: true});
					
					// We want this event handler to dispose of itself.
					tempOnDidCloseTerminal.dispose();
				}
			});
			// Add the disposable just in case it never fires
			context.subscriptions.push(tempOnDidCloseTerminal);
		});
	});
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
