import { MCPServer } from "../MCPServer.js";
import { LLMService } from "../ai/LLMService.js";
import { Council } from "./Council.js";

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
            if (!plan.toolName.startsWith('vscode_read') && !plan.toolName.startsWith('list_')) {
                const debate = await this.council.startDebate(`Action: ${plan.toolName}(${JSON.stringify(plan.params)}). Reasoning: ${plan.reasoning}`);

                // We add the Council's wisdom to the context history so the Agent can see it for the NEXT step.
                // But we DO NOT block the current action.
                context.history.push(`Council Advice for '${plan.toolName}': ${debate.summary}`);

                console.log(`[Director] 🛡️ Council Advice: ${debate.summary}`);
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
                    console.log("[Director] Detected Approval Prompt! Auto-Approving...");
                    await this.server.executeTool('native_input', { keys: 'y' });
                    await new Promise(r => setTimeout(r, 100)); // Small delay
                    await this.server.executeTool('native_input', { keys: 'enter' });
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
            // Instead of blind keys, we try to execute specific VS Code commands 
            // that trigger "Accept" or "Run" actions for inline chat / terminal.
            try {
                // Inline Chat Accept (Ctrl+Enter / Blue Button)
                await this.server.executeTool('vscode_execute_command', { command: 'inlineChat.accept' });

                // Terminal Quick Fix / Run
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.terminal.chat.accept' });

                // Standard Chat Submit (if pending)
                // await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.chat.submit' });
            } catch (e) {
                // Ignore failure if command not available
            }

            // Fallback: Try "Enter" key for modal dialogs that aren't API accessible
            // DISABLED per user request (too disruptive)
            /*
            try {
                 await this.server.executeTool('native_input', { keys: 'enter' });
            } catch (e) {}
            */

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
                // To re-enable, use a less intrusive method than clipboard hack.
                /*
                const termResult = await this.server.executeTool('vscode_read_terminal', {});
                // @ts-ignore
                const termContent = termResult.content?.[0]?.text || "";
                if (termContent.match(/\[y\/N\]/i)) {
                    console.log("[Director] Auto-Approving Terminal Prompt...");
                    await this.server.executeTool('native_input', { keys: 'y' });
                    await this.server.executeTool('native_input', { keys: 'enter' });
                }
                */

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

                    // Optional: Try to paste result back? 
                    // await this.server.executeTool('chat_reply', { text: result }); 
                }

            } catch (e) {
                // Ignore transient errors
            }

            // Poll every 2 seconds
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    /**
     * Starts the Self-Driving Mode.
     * 1. Reads task.md
     * 2. Finds next task.
     * 3. Submits to Chat.
     * 4. Auto-Accepts (periodically presses Alt+Enter via native_input).
     */
    async startAutoDrive(): Promise<string> {
        console.log(`[Director] Starting Auto-Drive...`);

        // 1. Start Auto-Accepter (Focuses Chat & Hits Alt+Enter)
        this.startAutoAccepter();

        // 2. Drive the Chat (Infinite Loop)
        while (true) {
            try {
                console.log("[Director] Auto-Drive: Deciding next move...");

                // A. Execute the task INTERNALLY (Headless Autonomy)
                console.log("[Director] Executing task internally...");
                const result = await this.executeTask("Read task.md, identify the next incomplete task, and proceed with implementing it.", 20);

                // B. POST-TASK HANDOFF (The "Supervisor" Step)
                // The task is done. Now we must type into the chat to prompt the NEXT cycle.
                console.log("[Director] Task Finished. Consulting Council for Handoff...");

                // Consult Council for the handoff message
                const debate = await this.council.startDebate(`Task finished with result: "${result.substring(0, 100)}...". What should I tell the Chat to do next?`);
                const nextInstruction = debate.summary.replace("Council Advice: ", "") || "Proceed to the next item in task.md.";

                const message = `Task Complete. Council Advice: ${nextInstruction}. Continuing...`;

                console.log(`[Director] Typing into Chat: "${message}"`);

                // 1. Focus Chat
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.chat.open' });
                // 2. Type Message
                await this.server.executeTool('chat_reply', { text: message });
                // 3. Submit (Hit Enter)
                await this.server.executeTool('vscode_submit_chat', {});

                // Small rest to let the Chat Agent react (if any)
                await new Promise(r => setTimeout(r, 5000));

            } catch (e: any) {
                console.error("[Director] Auto-Drive Error:", e.message);
                await new Promise(r => setTimeout(r, 10000)); // Backoff
            }
        }
    }

    private startAutoAccepter() {
        // Re-enabled per user request to handle "Accept" / "Allow" prompts automatically.
        // KEY CHANGE: We must FOCUS the Chat Panel before sending keys to avoid typing in the Terminal.
        console.log("[Director] Auto-Accepter active (Interval: 10s). Focusing Chat -> Alt+Enter.");

        setInterval(async () => {
            try {
                // 1. Focus the Chat Panel (Crucial!)
                await this.server.executeTool('vscode_execute_command', { command: 'workbench.action.chat.open' });

                // 2. Send "Alt+Enter" (Common shortcut to Accept/Allow in many MCP UIs)
                await this.server.executeTool('native_input', { keys: 'alt+enter' });

            } catch (e) {
                // Ignored.
            }
        }, 10000);
    }

    private async think(context: AgentContext): Promise<{ action: 'CONTINUE' | 'FINISH', toolName: string, params: any, result?: string, reasoning: string }> {
        // 1. Select Model
        const model = await this.server.modelSelector.selectModel({ taskComplexity: 'medium' });

        // 2. Construct Prompt
        const systemPrompt = `You are an Autonomous AI Agent called 'The Director'. 
Your goal is to achieve the user's objective by executing tools.
You are operating within the 'Antigravity' IDE context.

AVAILABLE TOOLS:
- vscode_get_status: Check active file/terminal.
- vscode_read_terminal: Read CLI output.
- vscode_read_selection: Read selected text.
- vscode_submit_chat: Submit the chat input.
- vscode_execute_command: Run VS Code commands.
- native_input: Simulate keyboard (e.g. { keys: 'enter' } for responding to prompts).
- chat_reply: Write text to the chat input (e.g. { text: 'Hello' }).
- list_files: Explore directory.
- read_file: Read file content.
- start_watchdog: Start continuous monitoring loop (if user asks to "watch" or "monitor").

RESPONSE FORMAT:
Return ONLY a valid JSON object (no markdown):
{
  "action": "CONTINUE" | "FINISH",
  "toolName": "name_of_tool",
  "params": { ...arguments },
  "reasoning": "Why you chose this action",
  "result": "Final answer (if FINISH)"
}

HEURISTICS:
- If user says "approve", use 'native_input' with 'enter'.
- If user says "submit", use 'vscode_submit_chat'.
- If user says "read terminal", use 'vscode_read_terminal'.
- If user says "watchdog", use 'start_watchdog'.
`;

        const userPrompt = `GOAL: ${context.goal}
        
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
