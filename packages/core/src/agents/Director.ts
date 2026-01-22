import { Router } from "../Router.js";
import { ModelSelector, ModelSelectionRequest } from "../ModelSelector.js";

interface AgentContext {
    goal: string;
    history: string[];
    maxSteps: number;
}

export class Director {
    private router: Router;
    private modelSelector: ModelSelector;

    constructor(router: Router, modelSelector: ModelSelector) {
        this.router = router;
        this.modelSelector = modelSelector;
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

            // 2. Act: Execute tool
            try {
                console.log(`[Director] Executing: ${plan.toolName}`);
                const result = await this.router.callTool(plan.toolName, plan.params);
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
            console.log(`[Director] Watchdog Cycle ${i + 1}/${maxCycles}`);

            // 1. Read State (Terminal)
            try {
                // We use our router to call the tool we defined in MCPServer
                const termResult = await this.router.callTool('vscode_read_terminal', {});
                // @ts-ignore
                const content = termResult.content?.[0]?.text || "";

                // 2. Analyze
                if (content.includes("Approve?") || content.match(/\[y\/N\]/i)) {
                    console.log("[Director] Detected Approval Prompt! Auto-Approving...");
                    await this.router.callTool('native_input', { keys: 'y' });
                    await new Promise(r => setTimeout(r, 100)); // Small delay
                    await this.router.callTool('native_input', { keys: 'enter' });
                }

                // 3. Keep Alive (Example: If users asks to continue)
                // This is risky to auto-trigger without specific prompt, but users asked for "submit instruction".
                // We'll look for "Please continue" prompt from the User in the chat output?
                // Or just keep the loop running.

            } catch (e) {
                console.error("[Director] Watchdog Read Failed:", e);
            }

            // Wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        return "Watchdog stopped.";
    }

    private async think(context: AgentContext): Promise<{ action: 'CONTINUE' | 'FINISH', toolName: string, params: any, result?: string, reasoning: string }> {
        // Smart Heuristics Dispatcher (Pre-LLM)
        const goal = context.goal.toLowerCase();
        const history = context.history;
        const lastEntry = history[history.length - 1] || "";

        // 1. Approval / Enter
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

        // 2. Chat / Post
        if (goal.includes("chat") || goal.includes("post") || goal.includes("write")) {
            // Check if we need to write text first
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
            reasoning: "No clear path forward."
        };
    }
}
