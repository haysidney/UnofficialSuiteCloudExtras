// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');

const compareFileWithFileCabinetBeginMessage = 'Downloading file from NetSuite...';
const deployObjectBeginMessage = 'Deploying object to NetSuite...';

const suiteCloudImportSuccessPattern = 'The following files were imported:';
const suiteCloudDeploySuccessPattern = 'Installation COMPLETE (';

const objectsPathPattern = 'src/Objects/';
const objectsTempDeployFolderName = '.tempDeploy';

const deployObjectDeployXml =
`<deploy>
	<configuration>
		<path>~/AccountConfiguration/.doNotDeploy/*</path>
	</configuration>
	<files>
		<path>~/FileCabinet/.doNotDeploy/*</path>
	</files>
	<objects>
		<path>~/Objects/${objectsTempDeployFolderName}/*</path>
	</objects>
	<translationimports>
		<path>~/Translations/.doNotDeploy/*</path>
	</translationimports>
</deploy>`;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('unofficial-suitecloud-extras.compareFileWithFileCabinet', () => { compareFileWithFileCabinet(context) }));

	context.subscriptions.push(vscode.commands.registerCommand('unofficial-suitecloud-extras.deployObject', () => { deployObject(context) }));
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

	// TODO Support non-powershell environments.
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

async function deployObject (context) {
	// TODO Add a setting for showing the Terminal.
	// TODO If said setting is hiding the terminal, then we'll show the following.
	vscode.window.showInformationMessage(deployObjectBeginMessage);

	await vscode.window.activeTextEditor.document.save();

	const currentFileUri = vscode.window.activeTextEditor.document.uri;
	const currentFilePath = currentFileUri.path;
	const currentFileName = path.basename(currentFilePath);
	const currentFileParentFolderPath = currentFilePath.slice(0, currentFilePath.indexOf(currentFileName));
	const currentFileParentFolderUri = vscode.Uri.file(currentFileParentFolderPath);

	// Make sure we're actually trying to deploy Objects.
	const objectsPathPatternMatchIndex = currentFilePath.indexOf(objectsPathPattern);
	if (objectsPathPatternMatchIndex == -1)
		return;

	const projectRootPath = currentFilePath.slice(0, objectsPathPatternMatchIndex);
	const objectsPath = projectRootPath + objectsPathPattern;
	const objectsTempDeployPath = objectsPath + objectsTempDeployFolderName + '/';
	console.log(objectsTempDeployPath);
	const objectsTempDeployUri = vscode.Uri.file(objectsTempDeployPath);
	
	// Create the temp deploy folder.
	await vscode.workspace.fs.createDirectory(objectsTempDeployUri);

	// Copy the file(s) to the temp deploy folder.
	const tempDeployFileUri = vscode.Uri.file(objectsTempDeployPath + currentFileName);
	await vscode.workspace.fs.copy(currentFileUri, tempDeployFileUri);
	
	// Backup the deploy.xml
	const deployXmlPath = projectRootPath + 'src/deploy.xml';
	const deployXmlUri = vscode.Uri.file(deployXmlPath);
	const tempDeployXmlPath = deployXmlPath + '.bak';
	const tempDeployXmlUri = vscode.Uri.file(tempDeployXmlPath);
	await vscode.workspace.fs.copy(deployXmlUri, tempDeployXmlUri, { overwrite: true });

	// Modify the deploy.xml to only deploy objects in the temp deploy folder.
	await vscode.workspace.fs.writeFile(deployXmlUri, deployObjectDeployXml);

	// TODO Deploy the object(s).

	// Delete the temp deploy folder.
	await vscode.workspace.fs.delete(objectsTempDeployUri, { recursive: true, useTrash: true });

	// Delete the modified deploy.xml.
	await vscode.workspace.fs.delete(deployXmlUri, { recursive: false, useTrash: false });

	// Rename the backup back to the original name.
	await vscode.workspace.fs.rename(tempDeployFileUri, deployXmlUri);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
