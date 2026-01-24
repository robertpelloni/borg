import type { MCPServer } from "../MCPServer.js";
import { LLMService } from "../ai/LLMService.js";
import { Council } from "./Council.js";
import { DIRECTOR_SYSTEM_PROMPT, GEMMA_ENCOURAGEMENT_MESSAGES } from "../prompts/SystemPrompts.js";

interface AgentContext {
    goal: string;
    history: string[];
    maxSteps: number;
}

export class Director {
    private server: MCPServer;
    private llmService: LLMService;
    private council: Council;
    private lastSelection: string = "";

    // Auto-Drive State
    private isAutoDriveActive: boolean = false;
    private currentStatus: 'IDLE' | 'THINKING' | 'DRIVING' = 'IDLE';
    private monitor: ConversationMonitor | null = null; // Smart Auto-Accepter

    constructor(server: MCPServer) {
        this.server = server;
        this.llmService = new LLMService();
        // Instantiate Council with server's model selector
        this.council = new Council(server.modelSelector);
    }

    /**
     * Starts an autonomous task loop.
     * @param goal The high-level objective.
     * @param maxSteps Safety limit to prevent infinite loops.
     */
    async executeTask(goal: string, maxSteps: number = 10): Promise<string> {
        const context: AgentContext = {
            goal,
            history: [],
            maxSteps
        };

        console.log(`[Director] Starting task: "${goal}" (Limit: ${maxSteps} steps)`);

        for (let step = 1; step <= maxSteps; step++) {
            console.log(`[Director] Step ${step}/${maxSteps}`);

            // 1. Think: Determine next action
            const plan = await this.think(context);
            context.history.push(`Thinking: ${plan.reasoning}`);

            if (plan.action === 'FINISH') {
                console.log("[Director] Task Completed.");
                return plan.result || "Task completed successfully.";
            }

            // 1b. COUNCIL ADVICE (Advisory Only)
            // If the action is significant (not just reading), consult the Council for optimization/insight.
            // SKIP if Autonomy is High (Full Self-Driving)
            const isHighAutonomy = this.server.permissionManager.getAutonomyLevel() === 'high';

            if (!isHighAutonomy && !plan.toolName.startsWith('vscode_read') && !plan.toolName.startsWith('list_')) {
                const debate = await this.council.startDebate(`Action: ${plan.toolName}(${JSON.stringify(plan.params)}). Reasoning: ${plan.reasoning}`);

                // We add the Council's wisdom to the context history so the Agent can see it for the NEXT step.
                // But we DO NOT block the current action.
                context.history.push(`Council Advice for '${plan.toolName}': ${debate.summary}`);

                console.log(`[Director] 🛡️ Council Advice: ${debate.summary}`);
            } else if (isHighAutonomy) {
                console.log(`[Director] ⚡ High Autonomy: Skipping Council Debate for ${plan.toolName}`);
            }

            // 2. Act: Execute tool
            try {
                console.log(`[Director] Executing: ${plan.toolName}`);
                // Use MCPServer's unified tool executor
                const result = await this.server.executeTool(plan.toolName, plan.params);
                const observation = JSON.stringify(result);

                // 3. Observe: Record result
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
     * Starts a continuous watchdog loop to monitor Antigravity/Terminal state.
     */
    async startWatchdog(maxCycles: number = 20): Promise<string> {
        console.log(`[Director] Starting Watchdog (Limit: ${maxCycles} cycles)`);

        for (let i = 0; i < maxCycles; i++) {
            if (i % 5 === 0) console.log(`[Director] ❤️ HEARTBEAT - Watchdog Cycle ${i + 1}/${maxCycles} (Listening for prompts...)`);

            // 1. Read State (Terminal)
            try {
                // Use MCPServer's unified tool executor
                const termResult = await this.server.executeTool('vscode_read_terminal', {});
                // @ts-ignore
                const content = termResult.content?.[0]?.text || "";

                // 2. Analyze
                console.log("[Director] Analyzing Terminal Content:", content.substring(content.length - 200).replace(/\n/g, '\\n')); // Log last 200 chars

                // Auto-Approve [y/N], [Y/n], or specific keywords
                const approvalRegex = /(?:approve\?|continue\?|\[y\/n\]|\[yes\/no\]|do you want to run this command\?)/i;
                if (approvalRegex.test(content) || content.includes("Approve?") || content.includes("Do you want to continue?")) {
                    console.log("[Director] Detected Approval Prompt! Auto-Approving... (DISABLED due to focus issues)");
                }

                // Keep-Alive / Resume?
                // If text says "Press any key to continue", do it.
                if (content.includes("Press any key to continue")) {
                    await this.server.executeTool('native_input', { keys: 'enter' });
                }

            } catch (e) {
                console.error("[Director] Watchdog Read Failed:", e);
            }

            // 3. Precise UI Interaction (VS Code API)
            // Instead of blind keys, we try to execute specific verified VS Code commands.
            try {
                // Inline Chat Accept
                await this.server.executeTool('vscode_execute_command', { command: 'interactive.acceptChanges' });

                // Terminal Quick Fix / Run
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.terminal.chat.accept' });

                // Standard Chat Submit (if pending)
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.chat.submit' });
            } catch (e) {
                // Ignore failure if command not available
            }

            // Wait 2 seconds (More aggressive than 5s)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        return "Watchdog stopped.";
    }

    /**
     * Starts a Chat Daemon that acts as a bridge.
     * It polls 'vscode_read_selection'. If text changes, it treats it as a prompt.
     */
    async startChatDaemon(): Promise<string> {
        console.log(`[Director] Starting Chat Daemon (Auto-Pilot Mode)`);
        console.log(`[Director] INSTRUCTION: Select text in Antigravity Chat to trigger me.`);

        while (true) { // Infinite Loop (Daemon)
            try {
                // 1. Check Terminal for Approvals (DISABLED by default to prevent Focus Stealing)
                // 2. Check Selection (Chat Bridge)
                const selResult = await this.server.executeTool('vscode_read_selection', {});
                // @ts-ignore
                const selection = selResult.content?.[0]?.text || "";

                if (selection && selection !== this.lastSelection && selection.trim().length > 0 && !selection.toLowerCase().includes("no content") && !selection.includes("undefined")) {
                    console.log(`[Director] New Instruction Detected: "${selection.substring(0, 50)}..."`);
                    this.lastSelection = selection;

                    // Execute the instruction
                    const result = await this.executeTask(selection, 5);
                    console.log(`[Director] Task Result: ${result}`);
                }

            } catch (e) {
                // Ignore transient errors
            }

            // Poll every 2 seconds
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    /**
     * Stops the Auto-Drive loop.
     */
    stopAutoDrive() {
        console.log("[Director] Stopping Auto-Drive...");
        this.isAutoDriveActive = false;
        this.currentStatus = 'IDLE';
        // Stop the monitor too!
        if (this.monitor) {
            this.monitor.stop();
            this.monitor = null;
        }
    }

    /**
     * Gets the current operational status.
     */
    getStatus() {
        return {
            active: this.isAutoDriveActive,
            status: this.currentStatus,
            goal: this.lastSelection // Re-using this field for now or add a new one
        };
    }

    /**
     * Starts the Self-Driving Mode.
     * 1. Reads task.md
     * 2. Finds next task.
     * 3. Submits to Chat.
     * 4. Auto-Accepts (via Smart Monitor).
     */
    async startAutoDrive(): Promise<string> {
        if (this.isAutoDriveActive) {
            return "Auto-Drive is already active.";
        }
        this.isAutoDriveActive = true;
        this.currentStatus = 'DRIVING';

        console.log(`[Director] Starting Auto-Drive (Manager Mode)...`);

        // 1. Start Smart Auto-Accepter
        this.startAutoAccepter();

        // 2. Management Loop
        while (this.isAutoDriveActive) {
            try {
                // A. Prompt the Agent
                const prompt = "⚠️ DIRECTOR INTERVENTION: Please check `task.md` for any remaining unchecked items. If all tasks are effectively done, verify the robustness of the 'Auto-Drive' mechanism itself. I am auto-accepting your changes.";

                console.log(`[Director] Directing Agent: "${prompt}"`);

                // Focus Chat & Send
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.chat.open' });
                await new Promise(r => setTimeout(r, 500));

                if (!this.isAutoDriveActive) break;

                await this.server.executeTool('chat_reply', { text: prompt });
                await new Promise(r => setTimeout(r, 500));

                // 1. Try VS Code Command FIRST
                await this.server.executeTool('vscode_submit_chat', {});

                // 2. Fallback: Native Enter
                await new Promise(r => setTimeout(r, 500));
                await this.server.executeTool('native_input', { keys: 'enter' });

                // 3. Force Submit (Ctrl+Enter)
                await new Promise(r => setTimeout(r, 200));
                await this.server.executeTool('native_input', { keys: 'control+enter' });

                // B. Wait / Supervise (Run for 3 minutes before re-prompting)
                console.log("[Director] Supervising development block (180s)...");

                for (let i = 0; i < 180; i++) {
                    if (!this.isAutoDriveActive) break;
                    await new Promise(r => setTimeout(r, 1000));
                }

            } catch (e: any) {
                console.error("[Director] Manager Error:", e.message);
                await new Promise(r => setTimeout(r, 10000));
            }
        }

        console.log("[Director] Auto-Drive Stopped.");
        return "Auto-Drive Stopped.";
    }

    /**
     * Starts the smart, state-aware auto-accepter.
     * Unlike the old "blind" clicker, this monitors the conversation state.
     */
    private startAutoAccepter() {
        console.log("[Director] 🧠 Starting Smart Auto-Accepter (State-Aware)...");
        // Pass callback to check active state
        this.monitor = new ConversationMonitor(this.server, this.llmService, () => this.isAutoDriveActive);
        this.monitor.start();
    }

    private async think(context: AgentContext): Promise<{ action: 'CONTINUE' | 'FINISH', toolName: string, params: any, result?: string, reasoning: string }> {
        // 0. Memory Recall (RAG)
        let memoryContext = "";
        try {
            // @ts-ignore
            const memoryResult = await this.server.executeTool("search_codebase", { query: context.goal });
            // @ts-ignore
            const memoryText = memoryResult.content?.[0]?.text || "";
            if (memoryText && !memoryText.includes("No matches")) {
                memoryContext = `\nRELEVANT CODEBASE CONTEXT:\n${memoryText.substring(0, 2000)}\n`;
                console.log(`[Director] 🧠 Recalled ${memoryText.length} chars of context.`);
            }
        } catch (e) {
            // Ignore memory errors
        }

        // 1. Select Model
        const model = await this.server.modelSelector.selectModel({ taskComplexity: 'medium' });

        // 2. Construct Prompt
        const systemPrompt = DIRECTOR_SYSTEM_PROMPT;

        const userPrompt = `GOAL: ${context.goal}
${memoryContext}

HISTORY:
${context.history.join('\n')}

What is the next step?`;

        // 3. Generate (if API Key exists)
        try {
            const response = await this.llmService.generateText(model.provider, model.modelId, systemPrompt, userPrompt);

            // Clean response (remove markdown code blocks if any)
            let jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const plan = JSON.parse(jsonStr);
            return plan;

        } catch (error) {
            // console.error("LLM Error, falling back to heuristics:", error);
            // Fallback to Heuristics if LLM fails (e.g. no key)
            return this.heuristicFallback(context);
        }
    }

    private heuristicFallback(context: AgentContext): any {
        const goal = context.goal.toLowerCase();
        const lastEntry = context.history[context.history.length - 1] || "";

        if (goal.includes("approve") || goal.includes("enter") || goal.includes("confirm")) {
            if (lastEntry.includes("Action: native_input")) {
                return { action: 'FINISH', toolName: '', params: {}, result: "Approved.", reasoning: "Approval sent." };
            }
            return {
                action: 'CONTINUE',
                toolName: 'native_input',
                params: { keys: 'enter' },
                reasoning: "User wants to approve/press enter."
            };
        }

        if (goal.includes("chat") || goal.includes("post") || goal.includes("write")) {
            const textMatch = context.goal.match(/say "(.*)"/) || context.goal.match(/write "(.*)"/);
            const text = textMatch ? textMatch[1] : null;

            if (text && !lastEntry.includes("chat_reply")) {
                return {
                    action: 'CONTINUE',
                    toolName: 'chat_reply',
                    params: { text },
                    reasoning: `Writing "${text}" to chat.`
                };
            }

            if ((goal.includes("submit") || goal.includes("send")) && !lastEntry.includes("vscode_submit_chat")) {
                return {
                    action: 'CONTINUE',
                    toolName: 'vscode_submit_chat',
                    params: {},
                    reasoning: "Submitting chat."
                };
            }

            return { action: 'FINISH', toolName: '', params: {}, result: "Chat interaction done.", reasoning: "Finished chat actions." };
        }

        // 3. Status / Check
        if (goal.includes("status") || goal.includes("check")) {
            if (lastEntry.includes("vscode_get_status")) {
                return { action: 'FINISH', toolName: '', params: {}, result: lastEntry, reasoning: "Status checked." };
            }
            return {
                action: 'CONTINUE',
                toolName: 'vscode_get_status',
                params: {},
                reasoning: "Checking editor status."
            };
        }

        // 4. Read Selection/Terminal
        if (goal.includes("read")) {
            if (goal.includes("terminal")) {
                return { action: 'CONTINUE', toolName: 'vscode_read_terminal', params: {}, reasoning: "Reading terminal output." };
            }
            return { action: 'CONTINUE', toolName: 'vscode_read_selection', params: {}, reasoning: "Reading editor selection." };
        }

        if (goal.includes("watchdog")) {
            return { action: 'CONTINUE', toolName: 'start_watchdog', params: { maxCycles: 100 }, reasoning: "Starting supervisor watchdog." };
        }

        // 5. Default: List Files (Safety Fallback)
        if (!lastEntry) {
            return {
                action: 'CONTINUE',
                toolName: 'list_files',
                params: { path: process.cwd() },
                reasoning: "I need to see where I am to start."
            };
        }

        if (lastEntry.includes("Observation")) {
            return {
                action: 'FINISH',
                toolName: '',
                params: {},
                result: "Task completed based on available heuristics.",
                reasoning: "Goal achieved or unknown."
            };
        }

        return {
            action: 'FINISH',
            toolName: '',
            params: {},
            reasoning: "No clear path forward. Please add API Keys to .env for AI reasoning."
        };
    }
}

/**
 * Monitors the conversation flow and takes appropriate actions based on state.
 * avoiding blind clicking/submitting when the AI is working.
 */
class ConversationMonitor {
    private server: MCPServer;
    private llmService: LLMService;
    private isActive: () => boolean;
    private interval: NodeJS.Timeout | null = null;
    private lastActivityTime: number = Date.now();

    // Encouragement messages from "The Investor"
    private messages = GEMMA_ENCOURAGEMENT_MESSAGES;

    constructor(server: MCPServer, llmService: LLMService, isActive: () => boolean) {
        this.server = server;
        this.llmService = llmService;
        this.isActive = isActive;
    }

    start() {
        if (this.interval) clearInterval(this.interval);
        // Slower interval (5s) to reduce focus fighting
        this.interval = setInterval(async () => {
            await this.checkAndAct();
        }, 5000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    private async checkAndAct() {
        if (!this.isActive()) {
            console.log("[ConversationMonitor] Auto-Drive Stopped. Stopping Monitor.");
            this.stop();
            return;
        }

        try {
            const state = await this.detectConversationState();
            await this.respondToState(state);
        } catch (e) {
            console.error("[ConversationMonitor] Error:", e);
        }
    }

    private async detectConversationState(): Promise<'AI_WORKING' | 'NEEDS_APPROVAL' | 'NEEDS_STEER' | 'IDLE'> {
        // 1. Check Terminal Content for Approval Prompts
        try {
            // @ts-ignore
            const termResult = await this.server.executeTool('vscode_read_terminal', {});
            // @ts-ignore
            const content = (termResult.content?.[0]?.text || "").trim();
            const lastLines = content.slice(-500); // Check last 500 chars
            console.log("[Director] Debug Terminal:", lastLines.slice(-100).replace(/\n/g, '\\n'));

            // Approval Cues (Strict but broader)
            const approvalRegex = /(?:approve\?|continue\?|\[y\/n\]|\(y\/n\)|\[yes\/no\]|\(yes\/no\)|do you want to run this command\?)/i;
            if (approvalRegex.test(lastLines) || lastLines.includes("Approve?")) {
                return 'NEEDS_APPROVAL';
            }
        } catch (e) { }

        const idleTime = Date.now() - this.lastActivityTime;

        // 2. Steering (Between Tasks)
        // User said: "ok to wait ... a whole minute ... between tasks"
        // If > 90s idle, we assume task is finished.
        if (idleTime > 90000) {
            return 'NEEDS_STEER';
        }

        // 3. Idle (Mid-Task Stalls)
        // Only if > 10s idle
        if (idleTime > 10000) {
            return 'IDLE';
        }

        return 'AI_WORKING';
    }

    private async respondToState(state: string) {
        // Always try safe interactions first
        try { await this.server.executeTool('vscode_execute_command', { command: 'interactive.acceptChanges' }); } catch (e) { }

        if (state === 'NEEDS_APPROVAL') {
            const idleTime = Date.now() - this.lastActivityTime;
            // Debounce: Don't spam enter. 
            console.log("[Director] 🟢 Approval Needed -> Alt+Enter");
            try { await this.server.executeTool('native_input', { keys: 'alt+enter' }); } catch (e) { }
            this.lastActivityTime = Date.now(); // Reset to prevent rapid firing
        }
        else if (state === 'NEEDS_STEER') {
            console.log("[Director] 🔵 Session Finished/Idle -> Generating Smart Steering...");
            await this.sendSteer();
            this.lastActivityTime = Date.now();
        }
        else if (state === 'IDLE') {
            // Passive monitoring only. Do NOT poke the chat randomly.
            // This prevents focus stealing when user is typing.
        }
    }

    private async sendSteer() {
        // SMART STEERING: Suggest next task
        try {
            // 1. Read Task List (Heuristic path, hard to dynamic find, so generic fallback)
            // const taskContent = ... 

            console.log(`[Director] 🤖 Generating Smart Steering via LLM...`);

            // 1. Get Model
            const model = await this.server.modelSelector.selectModel({ taskComplexity: 'low' }); // Fast model is fine

            // 2. Prompt
            const prompt = `You are the Project Director. The user (and their AI agent) have been idle for over 90 seconds. 
            Your goal is to gently nudge them to continue progress. 
            
            Check the task.md status conceptually (assume we are working on 'borg' agentic framework).
            Generate a short, encouraging, 1-sentence prompt to get them back on track. 
            Examples: "Status check? Are we ready for the next task?", "Shall we review the pending items in task.md?", "System is idle. Awaiting next command."
            
            Output ONLY the message string.`;

            const response = await this.llmService.generateText(model.provider, model.modelId, "You are a helpful AI Director.", prompt);
            let msg = response.content.trim().replace(/^"|"$/g, ''); // Remove quotes

            if (!msg) msg = "Status check? Ready for next instruction.";

            console.log(`[Director] 🤖 Steering: "${msg}"`);

            await this.server.executeTool('chat_reply', { text: msg });
            await new Promise(r => setTimeout(r, 500));
            // Auto-submit
            await this.server.executeTool('vscode_submit_chat', {});

        } catch (e: any) {
            // console.error("Steering failed:", e.message);
            // Fallback quietly to avoid spamming the console when offline
            const fallback = "Status check? System idle.";
            try { await this.server.executeTool('chat_reply', { text: fallback }); } catch (err) { }
        }
    }

    private async sendEncouragement() {
        const msg = this.messages[Math.floor(Math.random() * this.messages.length)];
        console.log(`[Director] 💎 Gemma: "${msg}"`);
    }
}
