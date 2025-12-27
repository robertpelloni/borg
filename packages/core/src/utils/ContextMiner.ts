
import { LogManager } from '../managers/LogManager.js';
import { MemoryManager } from '../managers/MemoryManager.js';
import { AgentExecutor } from '../agents/AgentExecutor.js';

export class ContextMiner {
    constructor(
        private logManager: LogManager,
        private memoryManager: MemoryManager,
        private agentExecutor: AgentExecutor
    ) {}

    /**
     * Analyze a session to find abandoned threads, summarize key decisions,
     * and optimize memory usage.
     * @param sessionId The ID of the session to analyze (optional, defaults to recent logs)
     */
    async mineContext(sessionId?: string) {
        console.log(`[ContextMiner] Starting analysis for session: ${sessionId || 'recent'}`);

        // 1. Retrieve Logs
        // If no sessionId, we look at the last 100 interactions
        const logs = await this.logManager.getLogs({ 
            limit: 100,
            // We want full details to analyze content
            summary: false 
        });

        if (logs.length === 0) {
            return { status: 'no_data', message: 'No logs found to analyze.' };
        }

        // 2. Prepare Context for the Analyst Agent
        // We format the logs into a readable transcript
        const transcript = logs.map(l => {
            let content = '';
            if (l.type === 'request') content = `User/System called ${l.tool} with ${JSON.stringify(l.args)}`;
            if (l.type === 'response') content = `Tool returned: ${JSON.stringify(l.result).substring(0, 200)}...`;
            if (l.type === 'error') content = `Error: ${JSON.stringify(l.error)}`;
            return `[${new Date(l.timestamp).toISOString()}] ${content}`;
        }).join('\n');

        // 3. Run the Analyst Agent
        const analystAgent = {
            name: "ContextAnalyst",
            description: "Expert at analyzing conversation logs to extract insights and optimize memory.",
            instructions: `
                You are the Context Analyst. Your job is to review the provided session transcript and:
                1. Identify "Abandoned Threads": Topics or tasks that were started but not completed.
                2. Summarize "Key Decisions": Important choices made by the user or agent.
                3. Extract "Reusable Facts": Information that should be stored in long-term memory.
                
                Output your analysis in JSON format:
                {
                    "abandoned_threads": ["..."],
                    "key_decisions": ["..."],
                    "facts": ["..."],
                    "summary": "..."
                }
            `,
            model: "gpt-4-turbo" // Use a smart model for analysis
        };

        try {
            const analysisResult = await this.agentExecutor.run(
                analystAgent, 
                `Analyze this transcript:\n\n${transcript}`
            );

            // 4. Process the Analysis
            let analysis;
            try {
                // Attempt to parse JSON from the agent's output
                // The agent might wrap it in markdown code blocks
                const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysis = JSON.parse(jsonMatch[0]);
                } else {
                    analysis = { summary: analysisResult };
                }
            } catch (e) {
                console.warn('[ContextMiner] Failed to parse agent output as JSON, using raw text.');
                analysis = { summary: analysisResult };
            }

            // 5. Store Insights in Memory
            if (analysis.facts && Array.isArray(analysis.facts)) {
                for (const fact of analysis.facts) {
                    await this.memoryManager.remember({
                        content: fact,
                        tags: ['auto-mined', 'fact'],
                        providerId: 'default' // Use default provider
                    });
                }
            }

            // 6. Log the Audit
            this.logManager.log({
                type: 'response', // Using response type for internal system event
                tool: 'context_miner',
                result: analysis
            });

            return {
                status: 'success',
                analysis
            };

        } catch (e: any) {
            console.error('[ContextMiner] Analysis failed:', e);
            return { status: 'error', message: e.message };
        }
    }
}
