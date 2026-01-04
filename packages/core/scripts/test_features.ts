import { CodeExecutionManager } from '../src/managers/CodeExecutionManager.js';
import { LogManager } from '../src/managers/LogManager.js';
import { ContextAnalyzer } from '../src/utils/ContextAnalyzer.js';
import path from 'path';
import fs from 'fs';

async function testCodeMode() {
    console.log('--- Testing Code Mode ---');
    const manager = new CodeExecutionManager();
    
    const code = `
        const a = 10;
        const b = 20;
        const result = await call_tool('add', { a, b });
        return result;
    `;

    const toolCallback = async (name: string, args: any) => {
        console.log(`[MockTool] Called ${name} with`, args);
        if (name === 'add') return args.a + args.b;
        return null;
    };

    try {
        const result = await manager.execute(code, toolCallback);
        console.log('Code Execution Result:', result);
        if (result === '30') console.log('✅ Code Mode Test Passed');
        else console.error('❌ Code Mode Test Failed');
    } catch (e) {
        console.error('❌ Code Mode Error:', e);
    }
}

async function testContextAnalyzer() {
    console.log('\n--- Testing Context Analyzer ---');
    const messages = [
        { role: 'system', content: 'System Prompt' },
        { role: 'user', content: 'User Query' },
        { role: 'user', content: '[Memory] Some memory content' },
        { role: 'user', content: '```javascript\nconsole.log("code")\n```' },
        { role: 'tool', content: 'Tool Output' }
    ];

    const analysis = ContextAnalyzer.analyze(messages);
    console.log('Analysis:', JSON.stringify(analysis, null, 2));

    if (analysis.system > 0 && analysis.user > 0 && analysis.memory > 0 && analysis.code > 0 && analysis.tool_output > 0) {
        console.log('✅ Context Analyzer Passed');
    } else {
        console.error('❌ Context Analyzer Failed');
    }
}

async function testLogging() {
    console.log('\n--- Testing Logging ---');
    const logDir = path.join(process.cwd(), 'test_logs');
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
    
    const logger = new LogManager(logDir);
    
    const complexArgs = { 
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello world' }
        ]
    };

    logger.log({
        type: 'request',
        tool: 'test_tool',
        args: complexArgs
    });

    // Wait for async write
    await new Promise(r => setTimeout(r, 100));

    // Test 1: Get All (Summary)
    const summaries = await logger.getLogs({ tool: 'test_tool', summary: true });
    console.log('Retrieved Summaries:', summaries.length);
    if (summaries[0].args === undefined) {
        console.log('✅ Summary Mode Passed (args undefined)');
    } else {
        console.error('❌ Summary Mode Failed (args present)');
    }

    // Test 2: Get By ID (Full)
    const id = summaries[0].id;
    const fullLog = await logger.getLogById(id);
    
    if (fullLog && fullLog.args && fullLog.args.messages.length === 2) {
        console.log('✅ Detail Retrieval Passed');
    } else {
        console.error('❌ Detail Retrieval Failed');
    }
    
    // Close DB before cleanup
    logger.close();

    // Cleanup
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
}

async function main() {
    await testCodeMode();
    await testContextAnalyzer();
    await testLogging();
}

main().catch(console.error);
