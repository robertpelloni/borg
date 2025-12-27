import { CodeExecutionManager } from '../src/managers/CodeExecutionManager.js';
import { LogManager } from '../src/managers/LogManager.js';
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

async function testLogging() {
    console.log('\n--- Testing Logging ---');
    const logDir = path.join(process.cwd(), 'test_logs');
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
    
    const logger = new LogManager(logDir);
    
    logger.log({
        type: 'request',
        tool: 'test_tool',
        args: { foo: 'bar' }
    });

    // Wait for async write (sqlite is sync usually but let's be safe)
    await new Promise(r => setTimeout(r, 100));

    const logs = await logger.getLogs({ tool: 'test_tool' });
    console.log('Retrieved Logs:', logs.length);
    
    if (logs.length === 1 && logs[0].tool === 'test_tool') {
        console.log('✅ Logging Test Passed');
    } else {
        console.error('❌ Logging Test Failed');
    }
    
    // Close DB before cleanup
    logger.close();

    // Cleanup
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
}

async function main() {
    await testCodeMode();
    await testLogging();
}

main().catch(console.error);
