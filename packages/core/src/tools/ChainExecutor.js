export class ChainExecutor {
    server;
    constructor(server) {
        this.server = server;
    }
    /**
     * Executes a chain of tools sequentially, passing outputs as inputs if needed.
     */
    async executeChain(chain) {
        const results = [];
        let prevResult = null;
        console.log(`[ChainExecutor] Executing chain of ${chain.tools.length} tools...`);
        for (let i = 0; i < chain.tools.length; i++) {
            const step = chain.tools[i];
            console.log(`[ChainExecutor] Step ${i + 1}: ${step.toolName}`);
            // 1. Substitute variables in args
            const resolvedArgs = this.resolveArgs(step.args, results, prevResult);
            // 2. Execute tool
            try {
                const result = await this.server.executeTool(step.toolName, resolvedArgs);
                results.push(result);
                prevResult = result;
                console.log(`[ChainExecutor] Step ${i + 1} Result:`, result ? "Success" : "Empty");
            }
            catch (error) {
                console.error(`[ChainExecutor] Step ${i + 1} Failed:`, error);
                throw new Error(`Chain failed at step ${i + 1} (${step.toolName}): ${error.message}`);
            }
        }
        return results;
    }
    /**
     * Resolves argument placeholders like "{{prev.content[0].text}}" or "{{step1.result}}"
     */
    resolveArgs(args, pastResults, prevResult) {
        const json = JSON.stringify(args);
        // Regex to find {{...}} placeholders
        const resolvedJson = json.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const trimmedPath = path.trim();
            // Handle "prev" alias
            if (trimmedPath.startsWith('prev')) {
                return this.getValueFromPath(prevResult, trimmedPath.substring(4)); // Remove 'prev'
            }
            // Handle "stepN" alias (1-based index)
            if (trimmedPath.startsWith('step')) {
                const stepNumMatch = trimmedPath.match(/^step(\d+)(.*)/);
                if (stepNumMatch) {
                    const stepIndex = parseInt(stepNumMatch[1]) - 1;
                    if (stepIndex >= 0 && stepIndex < pastResults.length) {
                        return this.getValueFromPath(pastResults[stepIndex], stepNumMatch[2]);
                    }
                }
            }
            return match; // Keep definition if not resolved
        });
        return JSON.parse(resolvedJson);
    }
    getValueFromPath(obj, path) {
        if (!obj)
            return "";
        // Path is like ".content[0].text" or ".output"
        // Simple dot notation parser
        return path.split('.').filter(p => p).reduce((o, key) => {
            // Handle array access [0]
            if (key.includes('[')) {
                const [prop, indexStr] = key.split('[');
                const index = parseInt(indexStr.replace(']', ''));
                return o && o[prop] ? o[prop][index] : undefined;
            }
            return o ? o[key] : undefined;
        }, obj) || "";
    }
}
