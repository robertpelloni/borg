import { McpProxyManager } from '../managers/McpProxyManager.js';

interface PipelineStep {
    tool: string;
    args: any;
    outputKey?: string; // Key to store output in context
}

export const PipelineTool = {
    name: "run_pipeline",
    description: "Execute a sequence of tool calls, passing context between them.",
    inputSchema: {
        type: "object",
        properties: {
            steps: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        tool: { type: "string" },
                        args: { type: "object" },
                        outputKey: { type: "string" }
                    },
                    required: ["tool", "args"]
                }
            },
            initialContext: { type: "object" }
        },
        required: ["steps"]
    }
};

export async function executePipeline(proxy: McpProxyManager, steps: PipelineStep[], initialContext: any = {}) {
    let context = { ...initialContext };
    const results = [];

    for (const step of steps) {
        console.log(`[Pipeline] Executing ${step.tool}...`);

        // Context Substitution in Args
        // Simple {{key}} replacement
        const argsString = JSON.stringify(step.args);
        const resolvedArgsString = argsString.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            return context[key] !== undefined ? context[key] : `{{${key}}}`;
        });
        const resolvedArgs = JSON.parse(resolvedArgsString);

        try {
            const result = await proxy.callTool(step.tool, resolvedArgs);

            // Store result
            if (step.outputKey) {
                // If result is object with 'content' array (MCP standard), try to extract text
                let value = result;
                if (result?.content && Array.isArray(result.content)) {
                    value = result.content.map((c: any) => c.text).join('\n');
                }
                context[step.outputKey] = value;
            }

            results.push({ step: step.tool, status: 'success', result });
        } catch (error: any) {
            console.error(`[Pipeline] Step ${step.tool} failed:`, error);
            results.push({ step: step.tool, status: 'error', error: error.message });
            // Stop on error? For now, yes.
            throw new Error(`Pipeline failed at step ${step.tool}: ${error.message}`);
        }
    }

    return { results, finalContext: context };
}
