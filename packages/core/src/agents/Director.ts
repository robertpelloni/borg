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

    private async think(context: AgentContext): Promise<{ action: 'CONTINUE' | 'FINISH', toolName: string, params: any, result?: string, reasoning: string }> {
        // TODO: Replace this mock with actual LLM call via ModelSelector
        // For now, we simulate a simple pass-through or hardcoded logic to verify structure.

        // Mock Logic: If history is empty, list files. If files listed, finish.
        const lastEntry = context.history[context.history.length - 1];

        // Mock Logic: Dynamic Intent Detection
        const goalLower = context.goal.toLowerCase();

        if (!lastEntry) {
            if (goalLower.includes("status")) {
                return {
                    action: 'CONTINUE',
                    toolName: 'vscode_get_status',
                    params: {},
                    reasoning: "User asked for editor status."
                };
            }
            if (goalLower.includes("enter") || goalLower.includes("approve")) {
                return {
                    action: 'CONTINUE',
                    toolName: 'native_input',
                    params: { keys: 'enter' },
                    reasoning: "User wants to approve/press enter."
                };
            }
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
                result: "I have listed the files. Access verified.",
                reasoning: "Goal achieved."
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
