
import { ContextMiner } from '../src/utils/ContextMiner.js';
import { LogManager } from '../src/managers/LogManager.js';
import { MemoryManager } from '../src/managers/MemoryManager.js';
import { AgentExecutor } from '../src/agents/AgentExecutor.js';
import fs from 'fs';
import path from 'path';

// Mock Dependencies
class MockAgentExecutor extends AgentExecutor {
    constructor() { 
        // Pass mock secret manager to super
        super({} as any, new MockSecretManager() as any, {} as any); 
    }
    // Override initializeOpenAI to avoid actual API calls
    initializeOpenAI() {}
    
    async run(agent: any, task: string) {
        console.log(`[MockAgent] Analyzing task...`);
        return JSON.stringify({
            abandoned_threads: ["User asked about weather but didn't get a response"],
            key_decisions: ["User decided to use Python"],
            facts: ["User prefers Python over JS"],
            summary: "Analysis complete."
        });
    }
}

class MockSecretManager {
    getSecret(key: string) { return "sk-test"; }
}

class MockMemoryManager extends MemoryManager {
    constructor() { super('test_data', new MockSecretManager() as any); }
    async remember(args: any) {
        console.log(`[MockMemory] Remembering: ${args.content}`);
        return "mem_id";
    }
    // Override initOpenAI to avoid actual API calls
    initOpenAI() {}
}

async function testContextMiner() {
    console.log('--- Testing Context Miner ---');
    
    const logDir = path.join(process.cwd(), 'test_logs_miner');
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
    
    const logManager = new LogManager(logDir);
    const memoryManager = new MockMemoryManager();
    const agentExecutor = new MockAgentExecutor();
    
    const miner = new ContextMiner(logManager, memoryManager, agentExecutor);

    // 1. Seed Logs
    console.log('Seeding logs...');
    logManager.log({ type: 'request', tool: 'test_tool', args: { q: 'hello' } });
    logManager.log({ type: 'response', tool: 'test_tool', result: { answer: 'world' } });
    
    // Wait for async write
    await new Promise(r => setTimeout(r, 100));

    // 2. Run Miner
    console.log('Running Miner...');
    const result = await miner.mineContext();
    
    console.log('Miner Result:', JSON.stringify(result, null, 2));

    if (result.status === 'success' && result.analysis.facts.length > 0) {
        console.log('✅ Context Miner Test Passed');
    } else {
        console.error('❌ Context Miner Test Failed');
    }

    // Cleanup
    logManager.close();
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
}

testContextMiner().catch(console.error);
