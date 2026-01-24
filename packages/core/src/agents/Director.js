import { LLMService } from "../ai/LLMService.js";
import { Council } from "./Council.js";
import { DIRECTOR_SYSTEM_PROMPT } from "../prompts/SystemPrompts.js";
export class Director {
    server;
    llmService;
    council;
    lastSelection = "";
    // Auto-Drive State
    isAutoDriveActive = false;
    currentStatus = 'IDLE';
    monitor = null; // Smart Supervisor
    constructor(server) {
        this.server = server;
        this.llmService = new LLMService();
        this.council = new Council(server.modelSelector);
    }
    /**
     * Executes a single goal using the Director's reasoning loop.
     */
    async executeTask(goal, maxSteps = 10) {
        const context = {
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
            }
            catch (error) {
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
    async startAutoDrive() {
        if (this.isAutoDriveActive) {
            return "Auto-Drive is already active.";
        }
        this.isAutoDriveActive = true;
        this.currentStatus = 'DRIVING';
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
    startMonitor() {
        this.monitor = new ConversationMonitor(this.server, this.llmService, this);
        this.monitor.start();
    }
    // --- Helpers ---
    async broadcast(message) {
        // SAFE MODE: Console Log only. No chat_reply.
        console.error(`\n📢 [Director]: ${message}\n`);
    }
    async think(context) {
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
        }
        catch (e) { }
        const model = await this.server.modelSelector.selectModel({ taskComplexity: 'medium' });
        const systemPrompt = DIRECTOR_SYSTEM_PROMPT;
        const userPrompt = `GOAL: ${context.goal}\n${memoryContext}\nHISTORY:\n${context.history.join('\n')}\nWhat is the next step?`;
        try {
            const response = await this.llmService.generateText(model.provider, model.modelId, systemPrompt, userPrompt);
            let jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        }
        catch (error) {
            return this.heuristicFallback(context);
        }
    }
    heuristicFallback(context) {
        const goal = context.goal.toLowerCase();
        const lastEntry = context.history[context.history.length - 1] || "";
        // Safety: If no idea, list files
        if (!lastEntry)
            return { action: 'CONTINUE', toolName: 'list_files', params: { path: process.cwd() }, reasoning: "Looking around." };
        // Detect loops
        if (context.history.length > 5 && lastEntry === context.history[context.history.length - 3]) {
            return { action: 'FINISH', toolName: '', params: {}, result: "Stuck in loop.", reasoning: "Loop detected." };
        }
        return { action: 'FINISH', toolName: '', params: {}, result: "Heuristic finish.", reasoning: "No LLM response." };
    }
    // Expose for Monitor
    getIsActive() { return this.isAutoDriveActive; }
}
class ConversationMonitor {
    server;
    llmService;
    director;
    interval = null;
    lastActivityTime = Date.now();
    isRunningTask = false;
    constructor(server, llmService, director) {
        this.server = server;
        this.llmService = llmService;
        this.director = director;
    }
    start() {
        if (this.interval)
            clearInterval(this.interval);
        this.interval = setInterval(async () => {
            await this.checkAndAct();
        }, 5000);
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
        this.interval = null;
    }
    async checkAndAct() {
        if (!this.director.getIsActive()) {
            this.stop();
            return;
        }
        // AGGRESSIVE MODE: Always try to accept pending changes or prompts
        // This restores "How we had it before" (Blind Watchdog behavior)
        try {
            await this.server.executeTool('vscode_execute_command', { command: 'interactive.acceptChanges' });
        }
        catch (e) { }
        try {
            await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.terminal.chat.accept' });
        }
        catch (e) { }
        try {
            await this.server.executeTool('native_input', { keys: 'alt+enter' });
        }
        catch (e) { }
        // If Director is busy executing a task, don't interrupt (unless stuck?)
        if (this.isRunningTask) {
            return;
        }
        const state = await this.detectState();
        await this.respondToState(state);
    }
    async detectState() {
        // 1. Check Terminal for "Approve?" (Explicit)
        try {
            // @ts-ignore
            const termResult = await this.server.executeTool('vscode_read_terminal', {});
            // @ts-ignore
            const content = (termResult.content?.[0]?.text || "").trim().slice(-500);
            if (/(?:approve\?|continue\?|\[y\/n\])/i.test(content))
                return 'NEEDS_APPROVAL';
        }
        catch (e) { }
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
        if (idleTime > 10000 && !this.isRunningTask)
            return 'IDLE';
        return 'BUSY';
    }
    async respondToState(state) {
        if (state === 'NEEDS_APPROVAL') {
            console.error("[Director] 🟢 Auto-Approving...");
            // Try all acceptance methods, NO Typing in Chat.
            try {
                await this.server.executeTool('native_input', { keys: 'alt+enter' });
            }
            catch (e) { }
            try {
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.terminal.chat.accept' });
            }
            catch (e) { }
            try {
                await this.server.executeTool('vscode_execute_command', { command: 'interactive.acceptChanges' });
            }
            catch (e) { }
            this.lastActivityTime = Date.now();
        }
        else if (state === 'IDLE') {
            // IDLE -> Council Meeting -> Execution
            await this.runCouncilLoop();
            this.lastActivityTime = Date.now();
        }
    }
    async runCouncilLoop() {
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
            const directiveMatch = msg.match(/DIRECTIVE:\s*"(.*)"/);
            const directive = directiveMatch ? directiveMatch[1] : null;
            // 1. Log Dialogue to Console (Safe, no UI interferance)
            console.error(`\n\n🏛️ **COUNCIL HALL** 🏛️\n------------------------\n${msg}\n------------------------\n`);
            if (directive) {
                // 2. EXECUTE DIRECTLY
                await this.director.executeTask(directive);
            }
            else {
                console.error("[Director] No directive found in Council output.");
            }
        }
        catch (e) {
            console.error("Council Error:", e);
        }
        finally {
            this.isRunningTask =