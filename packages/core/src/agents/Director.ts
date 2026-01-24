import type { IMCPServer } from "../adk/AgentInterfaces.js";
import { LLMService } from "../ai/LLMService.js";
import { Council } from "./Council.js";
import { DIRECTOR_SYSTEM_PROMPT, GEMMA_ENCOURAGEMENT_MESSAGES } from "../prompts/SystemPrompts.js";

interface AgentContext {
    goal: string;
    history: string[];
    maxSteps: number;
}

export class Director {
    private server: IMCPServer;
    private llmService: LLMService;
    private council: Council;
    private lastSelection: string = "";

    // Auto-Drive State
    private isAutoDriveActive: boolean = false;
    private currentStatus: 'IDLE' | 'THINKING' | 'DRIVING' = 'IDLE';
    private monitor: ConversationMonitor | null = null; // Smart Supervisor

    constructor(server: IMCPServer) {
        this.server = server;
        this.llmService = new LLMService();
        // @ts-ignore
        this.council = new Council(server.modelSelector);
    }

    /**
     * Executes a single goal using the Director's reasoning loop.
     */
    async executeTask(goal: string, maxSteps: number = 10): Promise<string> {
        const context: AgentContext = {
            goal,
            history: [],
            maxSteps
        };

        console.error(`[Director] Starting task: "${goal}" (Limit: ${maxSteps} steps)`);
        await this.broadcast(`🎬 **Director Action**: ${goal}`);

        for (let step = 1; step <= maxSteps; step++) {
            if (!this.isAutoDriveActive && step > 1) { // Allow single run, but check auto flag if in loop
                // pass
            }

            console.error(`[Director] Step ${step}/${maxSteps}`);

            // 1. Think
            const plan = await this.think(context);
            context.history.push(`Thinking: ${plan.reasoning}`);

            if (plan.action === 'FINISH') {
                console.error("[Director] Task Completed.");
                return plan.result || "Task completed successfully.";
            }

            // 1b. Council Advice (Advisory)
            const isHighAutonomy = this.server.permissionManager.getAutonomyLevel() === 'high';
            if (!isHighAutonomy && !plan.toolName.startsWith('vscode_read') && !plan.toolName.startsWith('list_')) {
                // Quick consult, no blocking UI
                const debate = await this.council.startDebate(`Action: ${plan.toolName}. Reasoning: ${plan.reasoning}`);
                context.history.push(`Council Advice: ${debate.summary}`);
                console.error(`[Director] 🛡️ Council Advice: ${debate.summary}`);
            }

            // 2. Act
            try {
                console.error(`[Director] Executing: ${plan.toolName}`);
                const result = await this.server.executeTool(plan.toolName, plan.params);
                const observation = JSON.stringify(result);
                context.history.push(`Action: ${plan.toolName}(${JSON.stringify(plan.params)})`);
                context.history.push(`Observation: ${observation}`);
            } catch (error: any) {
                console.error(`[Director] Action Failed: ${error.message}`);
                context.history.push(`Error: ${error.message}`);
            }
        }

        return "Task stopped: Max steps reached.";
    }

    /**
     * Starts the Autonomous Loop.
     * Unlike before, this DOES NOT rely on the Chat Input Box.
     * It runs internally and posts updates to Chat.
     */
    async startAutoDrive(): Promise<string> {
        if (this.isAutoDriveActive) {
            return "Auto-Drive is already active.";
        }
        this.isAutoDriveActive = true;
        this.currentStatus = 'DRIVING';

        // Init Live Feed
        try {
            const fs = await import('fs');
            const path = await import('path');
            fs.writeFileSync(path.join(process.cwd(), 'DIRECTOR_LIVE.md'), '# 🎬 Director Live Feed\nWaiting for action...\n');
        } catch (e) { }

        console.error(`[Director] Starting Auto-Drive (Internal Loop)...`);
        await this.broadcast("⚡ **Auto-Drive Engaged**\nI am now operating autonomously. The Council will direct the workflow.");

        // Start Monitor to handle Idle states by triggering Council
        this.startMonitor();

        return "Auto-Drive Started.";
    }

    stopAutoDrive() {
        console.error("[Director] Stopping Auto-Drive...");
        this.isAutoDriveActive = false;
        this.currentStatus = 'IDLE';
        if (this.monitor) {
            this.monitor.stop();
            this.monitor = null;
        }
    }

    /**
     * The heartbeat of Autonomy.
     * Checks for "Needs Approval" (Terminal) or "Idle" (Needs Direction).
     */
    private startMonitor() {
        this.monitor = new ConversationMonitor(this.server, this.llmService, this);
        this.monitor.start();
    }

    // --- Helpers ---

    private async broadcast(message: string) {
        // SAFE MODE: Console Log for Terminal
        console.error(`\n📢 [Director]: ${message}\n`);

        // LIVE FEED: Write to DIRECTOR_LIVE.md for IDE Visibility
        try {
            const fs = await import('fs');
            const path = await import('path');
            const feedPath = path.join(process.cwd(), 'DIRECTOR_LIVE.md');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `\n### [${timestamp}] Director\n${message}\n`;

            // Append to file
            fs.appendFileSync(feedPath, logEntry);
        } catch (e) { }

        // LIVE FEED: Paste to Chat Window (User Request)
        // This utilizes the VS Code Extension Bridge via 'chat_reply'
        try {
            await this.server.executeTool('chat_reply', { text: `[Director]: ${message}` });
            // Auto-Submit: Press Enter to send the message
            await new Promise(r => setTimeout(r, 500)); // Wait for paste to complete
            await this.server.executeTool('vscode_submit_chat', {});
        } catch (e) { }
    }

    private async think(context: AgentContext): Promise<any> {
        // ... (Existing Think Logic with RAG) ...
        // Re-using the robust logic from previous version, simplified for brevity in this overwrite
        // but ensuring we include the heuristic fallback.

        let memoryContext = "";
        try {
            // @ts-ignore
            const memoryResult = await this.server.executeTool("search_codebase", { query: context.goal });
            // @ts-ignore
            const memoryText = memoryResult.content?.[0]?.text || "";
            if (memoryText && !memoryText.includes("No matches")) {
                memoryContext = `\nRELEVANT CODEBASE CONTEXT:\n${memoryText.substring(0, 2000)}\n`;
            }
        } catch (e) { }

        const model = await this.server.modelSelector.selectModel({ taskComplexity: 'medium' });
        const systemPrompt = DIRECTOR_SYSTEM_PROMPT;
        const userPrompt = `GOAL: ${context.goal}\n${memoryContext}\nHISTORY:\n${context.history.join('\n')}\nWhat is the next step?`;

        try {
            const response = await this.llmService.generateText(model.provider, model.modelId, systemPrompt, userPrompt);
            let jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            return this.heuristicFallback(context);
        }
    }

    private heuristicFallback(context: AgentContext): any {
        const goal = context.goal.toLowerCase();
        const lastEntry = context.history[context.history.length - 1] || "";

        // Safety: If no idea, list files
        if (!lastEntry) return { action: 'CONTINUE', toolName: 'list_files', params: { path: process.cwd() }, reasoning: "Looking around." };

        // Detect loops
        if (context.history.length > 5 && lastEntry === context.history[context.history.length - 3]) {
            return { action: 'FINISH', toolName: '', params: {}, result: "Stuck in loop.", reasoning: "Loop detected." };
        }

        return { action: 'FINISH', toolName: '', params: {}, result: "Heuristic finish.", reasoning: "No LLM response." };
    }

    // Expose for Monitor
    public getIsActive() { return this.isAutoDriveActive; }
}

class ConversationMonitor {
    private server: IMCPServer;
    private llmService: LLMService;
    private director: Director;
    private interval: NodeJS.Timeout | null = null;
    private summaryInterval: NodeJS.Timeout | null = null; // 2-min summary timer
    private lastActivityTime: number = Date.now();
    private isRunningTask: boolean = false;

    constructor(server: IMCPServer, llmService: LLMService, director: Director) {
        this.server = server;
        this.llmService = llmService;
        this.director = director;
    }

    start() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(async () => {
            await this.checkAndAct();
        }, 5000);

        // Periodic Summary: Every 2 minutes, read context and post to chat
        if (this.summaryInterval) clearInterval(this.summaryInterval);
        this.summaryInterval = setInterval(async () => {
            await this.postPeriodicSummary();
        }, 120000); // 2 minutes
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        if (this.summaryInterval) clearInterval(this.summaryInterval);
        this.interval = null;
        this.summaryInterval = null;
    }

    /**
     * Posts a periodic summary to the chat to keep the development loop alive.
     * Reads context files (README, ROADMAP, DIRECTOR_LIVE) and generates summary.
     */
    private async postPeriodicSummary() {
        if (!this.director.getIsActive()) return;
        if (this.isRunningTask) return; // Don't interrupt ongoing work

        try {
            const fs = await import('fs');
            const path = await import('path');
            const cwd = process.cwd();

            // Read context files
            let context = '## Current Context\n';
            const readFile = (name: string) => {
                try {
                    const p = path.join(cwd, name);
                    if (fs.existsSync(p)) {
                        const content = fs.readFileSync(p, 'utf8').substring(0, 1000);
                        return `### ${name}\n${content}\n`;
                    }
                } catch (e) { }
                return '';
            };

            context += readFile('README.md');
            context += readFile('docs/ROADMAP.md');
            context += readFile('docs/USER_DIRECTIVES_INBOX.md');
            context += readFile('DIRECTOR_LIVE.md');

            // Generate brief summary via LLM
            const prompt = `You are the Director. Based on the following context, write a 1-2 sentence status update for the development chat. Keep it brief and actionable.\n\n${context}`;
            const model = await this.server.modelSelector.selectModel({ task: 'summary' });
            const response = await this.llmService.generateText(model.provider, model.modelId, 'Director Status', prompt);
            const summary = response.content.trim().substring(0, 200);

            // Broadcast to chat with Alt-Enter submit
            await this.server.executeTool('chat_reply', { text: `📊 [Director Status]: ${summary}` });
            await new Promise(r => setTimeout(r, 500));
            await this.server.executeTool('vscode_submit_chat', {});

            console.error(`[Director] 📊 Posted periodic summary.`);
        } catch (e: any) {
            console.error(`[Director] Summary Error: ${e.message}`);
        }
    }

    private async checkAndAct() {
        console.error(`[Director] ❤️ Monitor Heartbeat (Active: ${this.director.getIsActive()})`); // DEBUG
        if (!this.director.getIsActive()) {
            this.stop();
            return;
        }

        // Accept pending changes via Extension (Safe, no terminal spam)
        // Only uses WebSocket bridge to VS Code Extension
        try { await this.server.executeTool('vscode_execute_command', { command: 'interactive.acceptChanges' }); } catch (e) { }
        try { await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.terminal.chat.accept' }); } catch (e) { }
        // REMOVED: native_input causes terminal spam. Alt-Enter handled by vscode_submit_chat instead.

        // If Director is busy executing a task, don't interrupt (unless stuck?)
        if (this.isRunningTask) {
            return;
        }

        const state = await this.detectState();
        await this.respondToState(state);
    }

    private async detectState(): Promise<'NEEDS_APPROVAL' | 'IDLE' | 'BUSY'> {
        // 1. Check Terminal for "Approve?" (Explicit)
        try {
            // @ts-ignore
            const termResult = await this.server.executeTool('vscode_read_terminal', {});
            // @ts-ignore
            const content = (termResult.content?.[0]?.text || "").trim().slice(-500);
            if (/(?:approve\?|continue\?|\[y\/n\])/i.test(content)) return 'NEEDS_APPROVAL';
        } catch (e) { }

        // 2. Check Time
        const idleTime = Date.now() - this.lastActivityTime;

        // 3. Infer UI Blockage (Inline Chat / Alt-Enter)
        // If we are technically "Running a Task" but have been idle for > 5s, 
        // we are likely waiting for an "Alt-Enter" confirmation in the UI.
        if (this.isRunningTask && idleTime > 5000) {
            console.error("[Director] ⚠️ Mid-Task Stall detected (UI Block?). Triggering Approval...");
            return 'NEEDS_APPROVAL';
        }

        // 4. True Idle (Council)
        if (idleTime > 10000 && !this.isRunningTask) return 'IDLE';

        return 'BUSY';
    }

    private async respondToState(state: string) {
        if (state === 'NEEDS_APPROVAL') {
            console.error("[Director] 🟢 Auto-Approving (Sending 'y' + Enter + Alt-Enter)...");

            // 1. CLI Terminal Approval
            try { await this.server.executeTool('native_input', { keys: 'y' }); } catch (e: any) { console.error(`[Auto-Approve] 'y' failed: ${e.message}`); }

            await new Promise(r => setTimeout(r, 500)); // Wait 500ms

            try { await this.server.executeTool('native_input', { keys: 'enter' }); } catch (e: any) { console.error(`[Auto-Approve] 'enter' 1 failed: ${e.message}`); }

            await new Promise(r => setTimeout(r, 500)); // Double Tap
            try { await this.server.executeTool('native_input', { keys: 'enter' }); } catch (e: any) { console.error(`[Auto-Approve] 'enter' 2 failed: ${e.message}`); }

            // 2. VS Code UI Approval (Fallback)
            await new Promise(r => setTimeout(r, 500));
            try { await this.server.executeTool('native_input', { keys: 'alt+enter' }); } catch (e: any) { console.error(`[Auto-Approve] 'alt+enter' failed: ${e.message}`); }

            // 3. Command Palette / Inline Chat
            try { await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.terminal.chat.accept' }); } catch (e) { }
            try { await this.server.executeTool('vscode_execute_command', { command: 'interactive.acceptChanges' }); } catch (e) { }

            this.lastActivityTime = Date.now();
        }
        else if (state === 'IDLE') {
            // IDLE -> Council Meeting -> Execution
            await this.runCouncilLoop();
            this.lastActivityTime = Date.now();
        }
    }

    private async runCouncilLoop() {
        this.isRunningTask = true;
        try {
            console.error(`[Director] 🤖 Convening Council...`);

            const model = await this.server.modelSelector.selectModel({ taskComplexity: 'high' });

            const prompt = `You are the Supervisor Council. The agent is IDLE.
            Personas: [Architect], [Product], [Critic].
            Review 'task.md' conceptually.
            Output a dialogue followed by a DIRECTIVE line.
            
            Format:
            [Architect]: ...
            [Product]: ...
            DIRECTIVE: "The specific task to run"
            `;

            const response = await this.llmService.generateText(model.provider, model.modelId, "Council", prompt);
            const msg = response.content.trim();

            // ROBUST REGEX: Capture EVERYTHING after "DIRECTIVE:" until end of line or string
            const directiveMatch = msg.match(/DIRECTIVE:\s*(.*)/i);
            // Remove surrounding quotes if they exist, but keep internal quotes
            let directive = directiveMatch ? directiveMatch[1].trim() : null;
            if (directive && directive.startsWith('"') && directive.endsWith('"')) {
                directive = directive.slice(1, -1);
            }

            // 1. Log Dialogue to Console (Safe, no UI interference)
            console.error(`\n\n🏛️ **COUNCIL HALL** 🏛️\n------------------------\n${msg}\n------------------------\n`);

            // 1b. Broadcast Council Summary to Chat
            try {
                // @ts-ignore
                await this.server.executeTool('chat_reply', { text: `🏛️ [Council]: ${directive || 'Deliberating...'}` });
            } catch (e) { }

            if (directive) {
                // 2. EXECUTE DIRECTLY
                await this.director.executeTask(directive);

                // 3. Broadcast Completion
                try {
                    // @ts-ignore
                    await this.server.executeTool('chat_reply', { text: `✅ [Director]: Task completed.` });
                } catch (e) { }
            } else {
                console.error("[Director] No directive found in Council output.");
            }

        } catch (e: any) {
            console.error("Council Error:", e);
        } finally {
            this.isRunningTask = false;
        }
    }
}
