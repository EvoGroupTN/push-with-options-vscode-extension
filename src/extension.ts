import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';

const readFileAsync = promisify(fs.readFile);
const execFileAsync = promisify(execFile);

export interface GitPushOptions {
    pushOptions: string[];
    force?: boolean;
    noVerify?: boolean;
    clientFlags?: string[];
}

function unquote(str: string): string {
    if (
        (str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))
    ) {
        return str.substring(1, str.length - 1);
    }
    return str;
}

function tokenizeInput(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (char === '"' || char === "'") {
            if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
                current += char;
            } else if (char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
                current += char;
            } else {
                current += char;
            }
        } else if (/\s/.test(char) && !inQuotes) {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current.length > 0) {
        tokens.push(current);
    }

    return tokens;
}

export function parsePushOptions(rawInputs: string[]): GitPushOptions {
    const pushOptions: string[] = [];
    const clientFlags: string[] = [];
    let force: boolean | undefined = undefined;
    let noVerify: boolean | undefined = undefined;

    for (const input of rawInputs) {
        if (!input || !input.trim()) {
            continue;
        }

        const tokens = tokenizeInput(input.trim());

        let i = 0;
        while (i < tokens.length) {
            const token = tokens[i];

            if (!token) {
                i++;
                continue;
            }

            if (token === '--force' || token === '--force-with-lease' || token === '-f') {
                force = true;
                if (!clientFlags.includes(token)) {
                    clientFlags.push(token);
                }
                i++;
            } else if (token === '--no-verify') {
                noVerify = true;
                if (!clientFlags.includes('--no-verify')) {
                    clientFlags.push('--no-verify');
                }
                i++;
            } else if (token.startsWith('--push-option=')) {
                const val = token.substring('--push-option='.length);
                if (val) {
                    pushOptions.push(unquote(val));
                }
                i++;
            } else if (token === '--push-option') {
                if (i + 1 < tokens.length) {
                    pushOptions.push(unquote(tokens[i + 1]));
                    i += 2;
                } else {
                    i++;
                }
            } else if (token.startsWith('-o=')) {
                const val = token.substring(3);
                if (val) {
                    pushOptions.push(unquote(val));
                }
                i++;
            } else if (token === '-o') {
                if (i + 1 < tokens.length) {
                    pushOptions.push(unquote(tokens[i + 1]));
                    i += 2;
                } else {
                    i++;
                }
            } else if (token.startsWith('-o') && token.length > 2) {
                const val = token.substring(2);
                if (val) {
                    pushOptions.push(unquote(val));
                }
                i++;
            } else if (token.startsWith('-')) {
                if (!clientFlags.includes(token)) {
                    clientFlags.push(token);
                }
                i++;
            } else {
                pushOptions.push(unquote(token));
                i++;
            }
        }
    }

    const result: GitPushOptions = { pushOptions };
    if (force !== undefined) {
        result.force = force;
    }
    if (noVerify !== undefined) {
        result.noVerify = noVerify;
    }
    if (clientFlags.length > 0) {
        result.clientFlags = clientFlags;
    }
    return result;
}

export function buildPushArgs(
    options: GitPushOptions,
    remote?: string,
    branch?: string
): string[] {
    const args: string[] = ['push'];

    if (remote) {
        args.push(remote);
    }
    if (branch) {
        args.push(branch);
    }

    if (options.noVerify) {
        args.push('--no-verify');
    }

    if (options.force) {
        args.push('--force-with-lease');
    }

    if (options.clientFlags) {
        for (const flag of options.clientFlags) {
            if (
                flag !== '--no-verify' &&
                flag !== '--force' &&
                flag !== '--force-with-lease' &&
                flag !== '-f'
            ) {
                args.push(flag);
            }
        }
    }

    if (options.pushOptions) {
        for (const opt of options.pushOptions) {
            args.push('-o', opt);
        }
    }

    return args;
}

export async function pushWithGitCli(
    repo: any,
    api: any,
    options: GitPushOptions,
    remote?: string,
    branch?: string
): Promise<void> {
    const gitPath = api?.git?.path || 'git';
    const cwd = repo.rootUri.fsPath;
    const args = buildPushArgs(options, remote, branch);

    await execFileAsync(gitPath, args, { cwd, env: process.env });
}

export async function executePush(
    repo: any,
    api: any,
    options: GitPushOptions
): Promise<void> {
    const branch = repo.state.HEAD?.name;
    const remote = repo.state.HEAD?.upstream?.remote || 'origin';

    const hasUnexpressibleClientFlags =
        options.noVerify ||
        (options.clientFlags &&
            options.clientFlags.some(
                flag => flag !== '--force' && flag !== '--force-with-lease' && flag !== '-f'
            ));

    if (hasUnexpressibleClientFlags) {
        await pushWithGitCli(repo, api, options, remote, branch);
        return;
    }

    try {
        const vscodePushOptions: { pushOptions?: string[]; force?: boolean } = {};
        if (options.pushOptions && options.pushOptions.length > 0) {
            vscodePushOptions.pushOptions = options.pushOptions;
        }
        if (options.force !== undefined) {
            vscodePushOptions.force = options.force;
        }

        await repo.push(remote, undefined, false, vscodePushOptions);
    } catch (apiError) {
        await pushWithGitCli(repo, api, options, remote, branch);
    }
}

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
            const predefinedOptions: { label: string; description?: string }[] = [
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
                    if (!line) {
                        continue;
                    }
                    
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

            const rawInputStrings: string[] = [];
            
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

                const selectedLabels = selection
                    .filter(item => item.label !== 'Custom...')
                    .map(item => item.label);

                rawInputStrings.push(...selectedLabels);

                if (selection.some(item => item.label === 'Custom...')) {
                    const customOption = await vscode.window.showInputBox({
                        placeHolder: 'Enter git push options (e.g., --force-with-lease or --push-option=ci.skip)',
                        prompt: 'Use --push-option= for server-specific options'
                    });
                    if (customOption === undefined) {
                        return; // User canceled custom input
                    }
                    if (customOption.trim()) {
                        rawInputStrings.push(customOption.trim());
                    }
                }
            } finally {
                quickPick.dispose();
            }

            if (rawInputStrings.length === 0) {
                return;
            }

            const parsedPushOptions = parsePushOptions(rawInputStrings);

            // Show progress during push
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Pushing to remote...",
                cancellable: false
            }, async () => {
                try {
                    await executePush(repo, api, parsedPushOptions);
                    vscode.window.showInformationMessage(`Successfully pushed to ${branch}`);
                } catch (error) {
                    throw new Error(`Git push failed: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
