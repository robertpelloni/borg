import { McpProxyManager } from '../managers/McpProxyManager.js';

export const PipelineTool = {
    name: "run_pipeline",
    description: "Execute a sequence of tools/commands, passing output from one to the next.",
    inputSchema: {
        type: "object",
        properties: {
            steps: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        tool: { type: "string" },
                        args: { type: "object" }
                    },
                    required: ["tool"]
                }
            },
            initialContext: { type: "string" }
        },
        required: ["steps"]
    }
};

export async function executePipeline(proxy: McpProxyManager, steps: any[], initialContext: string = '') {
    let currentContext = initialContext;
    const results = [];

    for (const step of steps) {
        // Inject context into args if a special placeholder exists, or append to a specific arg?
        // Simple convention: if args has 'input' or 'query', prepend context.
        // Or better: Assume the tool takes context if we don't handle it?
        // Let's just pass it as a special 'pipeline_context' arg that tools might ignore,
        // OR rely on the agent to construct args correctly.
        // BUT the agent doesn't know the output yet.
        // So we need variable substitution. "${PREV_OUTPUT}"

        const args = { ...step.args };
        for (const key in args) {
            if (typeof args[key] === 'string' && args[key].includes('${PREV_OUTPUT}')) {
                args[key] = args[key].replace('${PREV_OUTPUT}', currentContext);
            }
        }

        console.log(`[Pipeline] Running ${step.tool}...`);
        try {
            const result = await proxy.callTool(step.tool, args);
            // Extract text content
            let output = '';
            if (result.content && Array.isArray(result.content)) {
                output = result.content.map((c: any) => c.text).join('\n');
            } else {
                output = JSON.stringify(result);
            }

            currentContext = output;
            results.push({ tool: step.tool, output });
        } catch (e: any) {
            throw new Error(`Pipeline failed at step ${step.tool}: ${e.message}`);
        }
    }

    return results;
}
