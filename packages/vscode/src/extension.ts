import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

interface HubStatus {
    connected: boolean;
    url: string;
    agentCount?: number;
    toolCount?: number;
}

interface MemorySearchItem {
    label: string;
    detail: string;
    content: string;
}

interface ToolItem {
    label: string;
    description: string;
    detail: string;
    tool: any;
}

let hubStatus: HubStatus = { connected: false, url: '' };

export function activate(context: vscode.ExtensionContext) {
    console.log('AIOS Plugin is now active!');

    outputChannel = vscode.window.createOutputChannel('AIOS Hub');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'aios.showStatus';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const commands = [
        vscode.commands.registerCommand('aios.connect', connectToHub),
        vscode.commands.registerCommand('aios.disconnect', disconnectFromHub),
        vscode.commands.registerCommand('aios.showStatus', showHubStatus),
        vscode.commands.registerCommand('aios.runAgent', runAgent),
        vscode.commands.registerCommand('aios.searchMemory', searchMemory),
        vscode.commands.registerCommand('aios.rememberSelection', rememberSelection),
        vscode.commands.registerCommand('aios.listTools', listTools),
        vscode.commands.registerCommand('aios.invokeTool', invokeTool),
        vscode.commands.registerCommand('aios.openDashboard', openDashboard),
        vscode.commands.registerCommand('aios.showLogs', () => outputChannel.show()),
        vscode.commands.registerCommand('aios.startDebate', startCouncilDebate),
        vscode.commands.registerCommand('aios.viewAnalytics', viewSupervisorAnalytics),
        vscode.commands.registerCommand('aios.listDebateTemplates', listDebateTemplates),
        vscode.commands.registerCommand('aios.architectMode', startArchitectMode),
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));

    const config = vscode.workspace.getConfiguration('aios');
    if (config.get<boolean>('autoConnect')) {
        connectToHub();
    }
}

function updateStatusBar() {
    if (hubStatus.connected) {
        statusBarItem.text = `$(plug) AIOS: Connected`;
        statusBarItem.tooltip = `Connected to ${hubStatus.url}\nAgents: ${hubStatus.agentCount ?? '?'} | Tools: ${hubStatus.toolCount ?? '?'}`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(debug-disconnect) AIOS: Disconnected`;
        statusBarItem.tooltip = 'Click to view status';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

function log(message: string) {
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

async function connectToHub() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';
    const apiKey = config.get<string>('apiKey');

    if (socket) {
        socket.disconnect();
    }

    log(`Connecting to AIOS Hub at ${url}...`);

    socket = io(url, {
        query: { clientType: 'vscode' },
        auth: apiKey ? { apiKey } : undefined,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', async () => {
        hubStatus = { connected: true, url };
        log(`Connected to AIOS Hub`);
        vscode.window.showInformationMessage(`Connected to AIOS Hub at ${url}`);
        
        try {
            const response = await fetch(`${url}/api/system/status`);
            if (response.ok) {
                const status = await response.json();
                hubStatus.agentCount = status.agents?.count;
                hubStatus.toolCount = status.tools?.count;
            }
        } catch (_) {
            /* Status bar will show '?' */
        }
        
        updateStatusBar();
    });

    socket.on('disconnect', (reason) => {
        hubStatus.connected = false;
        log(`Disconnected from AIOS Hub: ${reason}`);
        vscode.window.showWarningMessage('Disconnected from AIOS Hub');
        updateStatusBar();
    });

    socket.on('connect_error', (error) => {
        log(`Connection error: ${error.message}`);
    });

    socket.on('hook_event', (event: any) => {
        log(`Hook event: ${JSON.stringify(event)}`);
        if (event.type === 'notification') {
            vscode.window.showInformationMessage(`[Hub] ${event.message}`);
        }
    });

    socket.on('agent:started', (data: any) => {
        log(`Agent started: ${data.agentId}`);
        vscode.window.showInformationMessage(`Agent ${data.agentId} started`);
    });

    socket.on('agent:completed', (data: any) => {
        log(`Agent completed: ${data.agentId}`);
        vscode.window.showInformationMessage(`Agent ${data.agentId} completed`);
    });

    socket.on('agent:error', (data: any) => {
        log(`Agent error: ${data.agentId} - ${data.error}`);
        vscode.window.showErrorMessage(`Agent ${data.agentId} error: ${data.error}`);
    });

    socket.on('tool:result', (data: any) => {
        log(`Tool result: ${data.tool} - ${JSON.stringify(data.result).substring(0, 200)}`);
    });
}

function disconnectFromHub() {
    if (socket) {
        socket.disconnect();
        socket = null;
        hubStatus = { connected: false, url: '' };
        updateStatusBar();
        vscode.window.showInformationMessage('Disconnected from AIOS Hub');
    }
}

async function showHubStatus() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    if (!hubStatus.connected) {
        const action = await vscode.window.showWarningMessage(
            `Not connected to AIOS Hub (${url})`,
            'Connect',
            'Open Dashboard'
        );
        if (action === 'Connect') {
            connectToHub();
        } else if (action === 'Open Dashboard') {
            openDashboard();
        }
        return;
    }

    try {
        const response = await fetch(`${url}/api/system/status`);
        if (response.ok) {
            const status = await response.json();
            const items = [
                `Status: ${status.status}`,
                `Uptime: ${Math.floor(status.uptime / 60)} minutes`,
                `Agents: ${status.agents?.count ?? 'N/A'}`,
                `Tools: ${status.tools?.count ?? 'N/A'}`,
                `Memory entries: ${status.memory?.entries ?? 'N/A'}`,
            ];
            vscode.window.showQuickPick(items, { title: 'AIOS Hub Status' });
        }
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to fetch status: ${e.message}`);
    }
}

async function runAgent() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    if (!hubStatus.connected) {
        vscode.window.showWarningMessage('Not connected to AIOS Hub. Connect first.');
        return;
    }

    try {
        const response = await fetch(`${url}/api/agents`);
        if (!response.ok) throw new Error('Failed to fetch agents');
        
        const agents = await response.json();
        const agentNames = agents.map((a: any) => a.name || a.id);

        const selected = await vscode.window.showQuickPick(agentNames, {
            title: 'Select Agent to Run',
            placeHolder: 'Choose an agent...'
        });

        if (!selected) return;

        const task = await vscode.window.showInputBox({
            title: 'Agent Task',
            prompt: 'Enter the task for the agent',
            placeHolder: 'e.g., Analyze the current file for improvements'
        });

        if (!task) return;

        const editor = vscode.window.activeTextEditor;
        const context: any = {};
        if (editor) {
            context.currentFile = editor.document.uri.fsPath;
            context.currentLanguage = editor.document.languageId;
            context.selection = editor.document.getText(editor.selection);
        }

        log(`Running agent ${selected} with task: ${task}`);
        vscode.window.showInformationMessage(`Starting agent: ${selected}`);

        const runResponse = await fetch(`${url}/api/agents/${selected}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, context })
        });

        if (!runResponse.ok) {
            const error = await runResponse.text();
            throw new Error(error);
        }

        const result = await runResponse.json();
        log(`Agent ${selected} result: ${JSON.stringify(result)}`);

        outputChannel.appendLine(`\n=== Agent ${selected} Result ===`);
        outputChannel.appendLine(JSON.stringify(result, null, 2));
        outputChannel.show();

    } catch (e: any) {
        log(`Error running agent: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to run agent: ${e.message}`);
    }
}

async function searchMemory() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    const query = await vscode.window.showInputBox({
        title: 'Search Memory',
        prompt: 'Enter search query',
        placeHolder: 'e.g., authentication patterns'
    });

    if (!query) return;

    try {
        log(`Searching memory for: ${query}`);
        const response = await fetch(`${url}/api/memory/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 10 })
        });

        if (!response.ok) throw new Error('Search failed');

        const results = await response.json();
        
        if (!results.length) {
            vscode.window.showInformationMessage('No memory entries found');
            return;
        }

        const items: MemorySearchItem[] = results.map((r: any, i: number) => ({
            label: `${i + 1}. ${r.content?.substring(0, 60) || 'No content'}...`,
            detail: `Score: ${r.score?.toFixed(2) || 'N/A'} | Tags: ${r.tags?.join(', ') || 'none'}`,
            content: r.content
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Memory Search Results',
            placeHolder: 'Select to view full content'
        });

        if (selected) {
            outputChannel.appendLine(`\n=== Memory Entry ===`);
            outputChannel.appendLine(selected.content);
            outputChannel.show();
        }

    } catch (e: any) {
        log(`Memory search error: ${e.message}`);
        vscode.window.showErrorMessage(`Memory search failed: ${e.message}`);
    }
}

async function rememberSelection() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const selection = editor.document.getText(editor.selection);
    if (!selection) {
        vscode.window.showWarningMessage('No text selected');
        return;
    }

    const tags = await vscode.window.showInputBox({
        title: 'Memory Tags',
        prompt: 'Enter tags (comma-separated)',
        placeHolder: 'e.g., code, pattern, typescript'
    });

    try {
        log(`Remembering selection (${selection.length} chars)`);
        const response = await fetch(`${url}/api/memory/remember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: selection,
                tags: tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
                metadata: {
                    source: 'vscode',
                    file: editor.document.uri.fsPath,
                    language: editor.document.languageId
                }
            })
        });

        if (!response.ok) throw new Error('Remember failed');

        vscode.window.showInformationMessage('Selection saved to memory');
        log('Selection saved to memory');

    } catch (e: any) {
        log(`Remember error: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to save to memory: ${e.message}`);
    }
}

async function listTools() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    try {
        const response = await fetch(`${url}/api/hub/tools`);
        if (!response.ok) throw new Error('Failed to fetch tools');

        const tools = await response.json();
        
        const items: ToolItem[] = tools.map((t: any) => ({
            label: t.name,
            description: t.namespace ? `[${t.namespace}]` : '',
            detail: t.description?.substring(0, 100) || 'No description',
            tool: t
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Available Tools',
            placeHolder: 'Select a tool to invoke'
        });

        if (selected) {
            invokeToolWithSchema(selected.tool);
        }

    } catch (e: any) {
        log(`List tools error: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to list tools: ${e.message}`);
    }
}

async function invokeTool() {
    const toolName = await vscode.window.showInputBox({
        title: 'Invoke Tool',
        prompt: 'Enter tool name',
        placeHolder: 'e.g., execute_code, mcp_chain'
    });

    if (!toolName) return;

    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    try {
        const response = await fetch(`${url}/api/hub/tools/${encodeURIComponent(toolName)}`);
        if (!response.ok) throw new Error(`Tool ${toolName} not found`);
        
        const tool = await response.json();
        await invokeToolWithSchema(tool);

    } catch (e: any) {
        log(`Invoke tool error: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to invoke tool: ${e.message}`);
    }
}

async function invokeToolWithSchema(tool: any) {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    const argsInput = await vscode.window.showInputBox({
        title: `Invoke: ${tool.name}`,
        prompt: 'Enter arguments as JSON',
        placeHolder: tool.inputSchema ? JSON.stringify(tool.inputSchema.properties || {}) : '{}'
    });

    if (argsInput === undefined) return;

    let args = {};
    try {
        args = argsInput ? JSON.parse(argsInput) : {};
    } catch {
        vscode.window.showErrorMessage('Invalid JSON arguments');
        return;
    }

    try {
        log(`Invoking tool ${tool.name} with args: ${JSON.stringify(args)}`);
        
        const response = await fetch(`${url}/api/hub/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: tool.name, arguments: args })
        });

        const result = await response.json();
        
        outputChannel.appendLine(`\n=== Tool: ${tool.name} ===`);
        outputChannel.appendLine(`Arguments: ${JSON.stringify(args, null, 2)}`);
        outputChannel.appendLine(`Result: ${JSON.stringify(result, null, 2)}`);
        outputChannel.show();

        vscode.window.showInformationMessage(`Tool ${tool.name} executed`);

    } catch (e: any) {
        log(`Tool execution error: ${e.message}`);
        vscode.window.showErrorMessage(`Tool execution failed: ${e.message}`);
    }
}

function openDashboard() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';
    vscode.env.openExternal(vscode.Uri.parse(url));
}

export function deactivate() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}

async function startCouncilDebate() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor. Open a file to debate.');
        return;
    }

    const description = await vscode.window.showInputBox({
        title: 'Council Debate',
        prompt: 'Describe what to debate about this code',
        placeHolder: 'e.g., Review security implications of this implementation'
    });

    if (!description) return;

    const selection = editor.document.getText(editor.selection);
    const context = selection || editor.document.getText();
    const filePath = editor.document.uri.fsPath;

    try {
        log(`Starting council debate: ${description}`);
        vscode.window.showInformationMessage('Starting council debate...');

        const response = await fetch(`${url}/api/council/debate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: {
                    id: `vscode-${Date.now()}`,
                    description,
                    files: [filePath],
                    context: context.substring(0, 10000)
                }
            })
        });

        if (!response.ok) throw new Error('Debate request failed');

        const result = await response.json();
        
        outputChannel.appendLine(`\n=== Council Debate Result ===`);
        outputChannel.appendLine(`Decision: ${result.decision}`);
        outputChannel.appendLine(`Consensus: ${result.consensusLevel}%`);
        outputChannel.appendLine(`Reasoning: ${result.reasoning}`);
        outputChannel.appendLine(`Votes: ${JSON.stringify(result.votes, null, 2)}`);
        outputChannel.show();

        vscode.window.showInformationMessage(`Council decision: ${result.decision} (${result.consensusLevel}% consensus)`);

    } catch (e: any) {
        log(`Council debate error: ${e.message}`);
        vscode.window.showErrorMessage(`Council debate failed: ${e.message}`);
    }
}

async function viewSupervisorAnalytics() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    try {
        const response = await fetch(`${url}/api/supervisor-analytics/summary`);
        if (!response.ok) throw new Error('Failed to fetch analytics');

        const data = await response.json();
        const summary = data.summary;

        const items = [
            `Total Supervisors: ${summary.totalSupervisors}`,
            `Total Debates: ${summary.totalDebates}`,
            `Approved: ${summary.totalApproved}`,
            `Rejected: ${summary.totalRejected}`,
            `Avg Consensus: ${summary.avgConsensus?.toFixed(1) || 'N/A'}%`,
            `Avg Confidence: ${summary.avgConfidence?.toFixed(2) || 'N/A'}`,
            summary.mostActive ? `Most Active: ${summary.mostActive.name} (${summary.mostActive.votes} votes)` : '',
            summary.highestApprovalRate ? `Top Performer: ${summary.highestApprovalRate.name} (${summary.highestApprovalRate.rate}%)` : '',
        ].filter(Boolean);

        await vscode.window.showQuickPick(items, { title: 'Supervisor Analytics' });

    } catch (e: any) {
        log(`Analytics error: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to fetch analytics: ${e.message}`);
    }
}

interface TemplatePickItem extends vscode.QuickPickItem {
    templateId: string;
    templateData: any;
}

async function listDebateTemplates() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    try {
        const response = await fetch(`${url}/api/debate-templates`);
        if (!response.ok) throw new Error('Failed to fetch templates');

        const data = await response.json();
        
        const items: TemplatePickItem[] = data.templates.map((t: any) => ({
            label: t.name,
            description: t.id,
            detail: t.description || 'No description',
            templateId: t.id,
            templateData: t
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Debate Templates',
            placeHolder: 'Select a template to start a debate'
        });

        if (selected) {
            await startDebateWithTemplate(selected.templateData);
        }

    } catch (e: any) {
        log(`Templates error: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to fetch templates: ${e.message}`);
    }
}

async function startDebateWithTemplate(template: any) {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const description = await vscode.window.showInputBox({
        title: `${template.name} Debate`,
        prompt: 'Describe the specific task',
        placeHolder: 'e.g., Review authentication implementation'
    });

    if (!description) return;

    const selection = editor.document.getText(editor.selection);
    const context = selection || editor.document.getText();

    try {
        log(`Starting ${template.name} debate`);
        vscode.window.showInformationMessage(`Starting ${template.name} debate...`);

        const response = await fetch(`${url}/api/debate-templates/${template.id}/debate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: {
                    description,
                    files: [editor.document.uri.fsPath],
                    context: context.substring(0, 10000)
                }
            })
        });

        if (!response.ok) throw new Error('Template debate failed');

        const result = await response.json();
        
        outputChannel.appendLine(`\n=== ${template.name} Debate Result ===`);
        outputChannel.appendLine(JSON.stringify(result, null, 2));
        outputChannel.show();

    } catch (e: any) {
        log(`Template debate error: ${e.message}`);
        vscode.window.showErrorMessage(`Template debate failed: ${e.message}`);
    }
}

async function startArchitectMode() {
    const config = vscode.workspace.getConfiguration('aios');
    const url = config.get<string>('hubUrl') || 'http://localhost:3000';

    const task = await vscode.window.showInputBox({
        title: 'Architect Mode',
        prompt: 'Describe the task for the reasoning model',
        placeHolder: 'e.g., Design a caching layer for the API endpoints'
    });

    if (!task) return;

    try {
        log(`Starting architect mode: ${task}`);
        vscode.window.showInformationMessage('Starting architect session...');

        const response = await fetch(`${url}/api/architect/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task })
        });

        if (!response.ok) throw new Error('Architect session failed');

        const session = await response.json();
        
        outputChannel.appendLine(`\n=== Architect Session: ${session.sessionId} ===`);
        outputChannel.appendLine(`Status: ${session.status}`);
        outputChannel.appendLine(`\n--- Reasoning Output ---`);
        outputChannel.appendLine(session.reasoningOutput || 'Reasoning in progress...');
        
        if (session.plan) {
            outputChannel.appendLine(`\n--- Edit Plan ---`);
            outputChannel.appendLine(`Description: ${session.plan.description}`);
            outputChannel.appendLine(`Complexity: ${session.plan.complexity}`);
            outputChannel.appendLine(`Files: ${session.plan.files?.join(', ')}`);
            outputChannel.appendLine(`Steps: ${JSON.stringify(session.plan.steps, null, 2)}`);
        }
        
        outputChannel.show();

        const action = await vscode.window.showInformationMessage(
            `Architect session created. Status: ${session.status}`,
            'Approve Plan',
            'Reject Plan',
            'View in Dashboard'
        );

        if (action === 'Approve Plan') {
            await fetch(`${url}/api/architect/sessions/${session.sessionId}/approve`, { method: 'POST' });
            vscode.window.showInformationMessage('Plan approved, edits being executed');
        } else if (action === 'Reject Plan') {
            await fetch(`${url}/api/architect/sessions/${session.sessionId}/reject`, { method: 'POST' });
            vscode.window.showInformationMessage('Plan rejected');
        } else if (action === 'View in Dashboard') {
            vscode.env.openExternal(vscode.Uri.parse(`${url}/architect/${session.sessionId}`));
        }

    } catch (e: any) {
        log(`Architect mode error: ${e.message}`);
        vscode.window.showErrorMessage(`Architect mode failed: ${e.message}`);
    }
}
