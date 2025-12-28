
import { LogManager } from './managers/LogManager.js';
import { McpProxyManager } from './managers/McpProxyManager.js';
import { McpManager } from './managers/McpManager.js';
import path from 'path';
import fs from 'fs';

async function testTraffic() {
    console.log('Testing Traffic Logging...');
    
    const logDir = path.join(process.cwd(), 'test_logs');
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
    
    const logManager = new LogManager(logDir);
    const mcpManager = new McpManager(path.join(process.cwd(), 'mcp-servers'));
    const proxyManager = new McpProxyManager(mcpManager, logManager);

    // Register a dummy tool
    proxyManager.registerInternalTool({
        name: 'slow_tool',
        description: 'A tool that takes time',
        inputSchema: { type: 'object', properties: { delay: { type: 'number' } } }
    }, async (args: any) => {
        await new Promise(resolve => setTimeout(resolve, args.delay || 100));
        return { content: [{ type: 'text', text: 'Done' }] };
    });

    await proxyManager.start();

    console.log('Calling slow_tool...');
    await proxyManager.callTool('slow_tool', { delay: 200 }, 'test-session');

    // Check logs
    const logs = await logManager.getLogs();
    console.log(`Total logs: ${logs.length}`);
    
    const responseLog = logs.find(l => l.type === 'response');
    if (responseLog) {
        console.log('Response Log:', JSON.stringify(responseLog, null, 2));
        if (responseLog.duration && responseLog.duration >= 200) {
            console.log('SUCCESS: Duration captured correctly.');
        } else {
            console.error('FAILURE: Duration missing or incorrect.');
        }
    } else {
        console.error('FAILURE: No response log found.');
    }

    logManager.close();
}

testTraffic().catch(console.error);
