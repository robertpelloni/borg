import * as vscode from 'vscode';
import WebSocket from 'ws';

let socket: WebSocket | null = null;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let reconnectTimer: NodeJS.Timeout | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Borg Plugin is now active!');
    outputChannel = vscode.window.createOutputChannel('Borg Hub');

    // Status Bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'borg.connect';
    updateStatusBar(false);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('borg.connect', connectToHub));
    context.subscriptions.push(vscode.commands.registerCommand('borg.disconnect', disconnectFromHub));

    // Auto Connect
    connectToHub();
}

function updateStatusBar(connected: boolean) {
    if (connected) {
        statusBarItem.text = `$(plug) Borg: Connected`;
        statusBarItem.tooltip = `Connected to Borg Core`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(debug-disconnect) Borg: Disconnected`;
        statusBarItem.tooltip = 'Click to Connect';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

function log(message: string) {
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

function connectToHub() {
    if (socket) return; // Already connecting or connected

    // Standard Borg Core WebSocket Port
    const url = 'ws://localhost:3001';

    log(`Connecting to ${url}...`);

    try {
        socket = new WebSocket(url);

        socket.on('open', () => {
            log('Connected to Borg Hub');
            updateStatusBar(true);
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            vscode.window.showInformationMessage('Connected to Borg Core');
        });

        socket.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(message);
            } catch (e) {
                log(`Failed to parse message: ${e}`);
            }
        });

        socket.on('close', () => {
            log('Disconnected');
            updateStatusBar(false);
            socket = null;
            // Auto reconnect
            reconnectTimer = setTimeout(connectToHub, 5000);
        });

        socket.on('error', (err) => {
            log(`Error: ${err.message}`);
            socket?.close();
        });

    } catch (e: any) {
        log(`Connection setup error: ${e.message}`);
    }
}

async function handleMessage(msg: any) {
    log(`Received: ${JSON.stringify(msg)}`);

    if (msg.type === 'VSCODE_COMMAND') {
        const { command, args } = msg;
        try {
            await vscode.commands.executeCommand(command, ...(args || []));
            log(`Executed: ${command}`);
        } catch (e: any) {
            log(`Failed to execute ${command}: ${e.message}`);
        }
    }

    if (msg.type === 'INSERT_TEXT') {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, msg.text);
            });
        }
    }

    if (msg.type === 'PASTE_INTO_CHAT') {
        try {
            // 1. Write to Clipboard
            await vscode.env.clipboard.writeText(msg.text);
            // 2. Focus Chat
            await vscode.commands.executeCommand('workbench.action.chat.open');
            // 3. Paste
            // We use a small delay to ensure focus
            await new Promise(r => setTimeout(r, 200));
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            log(`Executed: Paste into Chat`);
        } catch (e: any) {
            log(`Failed to paste into chat: ${e.message}`);
        }
    }

    if (msg.type === 'SUBMIT_CHAT_HOOK') {
        // Try to submit the chat
        try {
            // Focus chat first
            await vscode.commands.executeCommand('workbench.action.chat.open');
            // Submit
            await vscode.commands.executeCommand('workbench.action.chat.submit');
            log('Executed: Chat Submit');
        } catch (e: any) {
            log(`Failed to submit chat: ${e.message}`);
        }
    }

    if (msg.type === 'GET_STATUS') {
        const activeTerminal = vscode.window.activeTerminal;
        const status = {
            activeEditor: vscode.window.activeTextEditor?.document.fileName || null,
            activeTerminal: activeTerminal ? activeTerminal.name : null,
            // Note: VS Code API doesn't let us read notifications directly easily without a complex hack.
            // We can infer state or use a proxy. 
            // For now, let's return basic info.
            workspace: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || []
        };

        // Send back via separate channel or reliance on log? 
        // Best approach for Request-Response over WS without ID tracking is complex.
        // We will just emit an event back.
        if (socket) {
            socket.send(JSON.stringify({
                type: 'STATUS_UPDATE',
                requestId: msg.requestId,
                status
            }));
        }
    }

    if (msg.type === 'GET_SELECTION') {
        const editor = vscode.window.activeTextEditor;
        let content = '';
        if (editor) {
            content = editor.document.getText(editor.selection);
            if (!content) {
                // If no selection, get full text
                content = editor.document.getText();
            }
        }

        if (socket) {
            socket.send(JSON.stringify({
                type: 'STATUS_UPDATE',
                requestId: msg.requestId,
                status: { content }
            }));
        }
    }

    if (msg.type === 'GET_TERMINAL') {
        // "The Clipboard Hack" to read terminal
        try {
            await vscode.commands.executeCommand('workbench.action.terminal.focus');
            await new Promise(r => setTimeout(r, 100)); // Wait for focus
            await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
            await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
            await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');

            let content = await vscode.env.clipboard.readText();
            content = content.trim();

            if (!content) {
                content = "(Terminal is empty)";
            }

            if (socket) {
                socket.send(JSON.stringify({
                    type: 'STATUS_UPDATE',
                    requestId: msg.requestId,
                    status: { content }
                }));
            }
        } catch (e: any) {
            log(`Terminal Read Error: ${e.message}`);
            if (socket) {
                socket.send(JSON.stringify({
                    type: 'STATUS_UPDATE',
                    requestId: msg.requestId,
                    status: { content: `Error reading terminal: ${e.message}` }
                }));
            }
        }
    }
}

function disconnectFromHub() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) {
        socket.close();
        socket = null;
    }
    updateStatusBar(false);
}

export function deactivate() {
    disconnectFromHub();
}
