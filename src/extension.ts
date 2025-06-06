import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const readFileAsync = promisify(fs.readFile);

export async function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand('push-with-options.push', async () => {
        try {
            // Get current git repo
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            if (!gitExtension) {
                throw new Error('Git extension not found');
            }

            const api = gitExtension.getAPI(1);
            const repo = api.repositories[0];
            
            if (!repo) {
                throw new Error('No git repository found');
            }

            // Get current branch
            const branch = repo.state.HEAD?.name;
            if (!branch) {
                throw new Error('Unable to determine current branch');
            }

            // Read .push-options file if it exists
            let predefinedOptions: { label: string; description?: string }[] = [
                { label: '--no-verify', description: 'Skip pre-push hooks' },
                { label: 'Custom...', description: 'Enter custom push options' }
            ];

            try {
                const configPath = path.join(repo.rootUri.fsPath, '.push-options');
                const content = await readFileAsync(configPath, 'utf8');
                const lines = content.split('\n');
                
                let currentComment = '';
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    if (line.startsWith('#')) {
                        currentComment = line.substring(1).trim();
                    } else {
                        predefinedOptions.unshift({
                            label: line,
                            description: currentComment || undefined
                        });
                        currentComment = '';
                    }
                }
            } catch (err) {
                // File doesn't exist or can't be read, continue with default options
            }

            const quickPick = vscode.window.createQuickPick();
            quickPick.items = predefinedOptions;
            quickPick.placeholder = 'Select push options (use Space to select multiple)';
            quickPick.title = 'Push Options';
            quickPick.canSelectMany = true;

            let pushOptions = '';
            
            try {
                const selection = await new Promise<readonly vscode.QuickPickItem[]>((resolve) => {
                    quickPick.onDidAccept(() => {
                        resolve(quickPick.selectedItems);
                        quickPick.hide();
                    });
                    quickPick.onDidHide(() => resolve([]));
                    quickPick.show();
                });

                if (!selection.length) {
                    return; // User canceled
                }

                if (selection.some(item => item.label === 'Custom...')) {
                    const customOption = await vscode.window.showInputBox({
                        placeHolder: 'Enter git push options (e.g., --force-with-lease or --push-option=ci.skip)',
                        prompt: 'Use --push-option= for server-specific options'
                    });
                    if (!customOption) {
                        return; // User canceled custom input
                    }
                    pushOptions = customOption;
                } else {
                    pushOptions = selection.map(item => item.label).join(' ');
                }
            } finally {
                quickPick.dispose();
            }

            // Convert any -o to --push-option= for consistency
            pushOptions = pushOptions.replace(/\s+-o\s+/g, ' --push-option=');

            let command: string;
            if (pushOptions.toLowerCase().startsWith('git push ')) {
                command = pushOptions;
            } else {
                const remote = repo.state.remotes[0]?.name || 'origin'; // Use first remote or default to 'origin'
                const currentBranch = repo.state.HEAD?.name;
                if (!currentBranch) {
                    // This check is vital if not using a full user-provided command
                    throw new Error('Unable to determine current branch for push command');
                }
                // Ensure pushOptions is included only if it's not empty, to avoid extra spaces
                command = `git push ${remote} ${currentBranch} ${pushOptions ? pushOptions : ''}`.trim();
            }

            // Show progress during push
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Pushing to remote...",
                cancellable: false // TODO: Consider making this true and handling cancellation
            }, async () => { // Naming 'progress' and 'token' is conventional but not used here yet
                return new Promise<void>((resolve, reject) => {
                    // Execute the git push command. This will use the system's configured Git credential helper.
                    exec(command, { cwd: repo.rootUri.fsPath }, (error, stdout, stderr) => {
                        if (error) {
                            let errorMessage = `Git push failed: ${error.message}`;
                            if (stderr) {
                                errorMessage += `\nStderr: ${stderr.trim()}`;
                            }
                            vscode.window.showErrorMessage(errorMessage);
                            reject(new Error(errorMessage)); // Reject the promise for withProgress
                            return;
                        }

                        if (stderr && (stderr.toLowerCase().includes('error:') || stderr.toLowerCase().includes('fatal:'))) {
                            vscode.window.showErrorMessage(`Git push failed (reported via stderr): ${stderr.trim()}`);
                            reject(new Error(stderr.trim()));
                            return;
                        }

                        let successMessage = 'Git push command completed.';
                        // Git push often sends its primary output (even success) to stderr.
                        // Stdout is often empty or used for specific data transfer phases.
                        const outputToShow = stderr || stdout; // Prefer stderr if it has content.
                        if (outputToShow && outputToShow.trim().length > 0) {
                            successMessage += `\nOutput:\n${outputToShow.trim()}`;
                        }
                        vscode.window.showInformationMessage(successMessage);
                        resolve(); // Resolve the promise for withProgress
                    });
                });
            });
            // Note: The old success message `vscode.window.showInformationMessage(\`Successfully pushed to ${branch}\`)`
            // and the warning for unsupported options are removed.
            // The main try...catch block around withProgress will catch rejections from the Promise.
        } catch (error) {
            vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
