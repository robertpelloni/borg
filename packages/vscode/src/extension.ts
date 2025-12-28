import * as vscode from 'vscode';
import { io } from 'socket.io-client';

let socket: any;

export function activate(context: vscode.ExtensionContext) {
	console.log('Super AI Plugin is now active!');

	let disposable = vscode.commands.registerCommand('super-ai.connect', () => {
		const config = vscode.workspace.getConfiguration('super-ai');
        const url = config.get<string>('hubUrl') || 'http://localhost:3000';

        if (socket) {
            socket.disconnect();
        }

        socket = io(url, {
            query: { clientType: 'vscode' }
        });

        socket.on('connect', () => {
            vscode.window.showInformationMessage(`Connected to Super AI Hub at ${url}`);
        });

        socket.on('disconnect', () => {
            vscode.window.showWarningMessage('Disconnected from Super AI Hub');
        });

        socket.on('hook_event', (event: any) => {
            if (event.type === 'notification') {
                vscode.window.showInformationMessage(`[Hub] ${event.message}`);
            }
        });
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
    if (socket) socket.disconnect();
}
