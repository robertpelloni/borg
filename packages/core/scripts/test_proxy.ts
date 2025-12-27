
import { McpProxyManager } from '../src/managers/McpProxyManager.js';
import { EventEmitter } from 'events';

// Mock McpManager
class MockMcpManager extends EventEmitter {
    getAllServers() { return []; }
    getClient(name: string) { return null; }
}

// Mock LogManager
class MockLogManager {
    log(entry: any) { console.log('[Log]', entry.type, entry.tool); }
}

async function testProxy() {
    console.log('--- Testing McpProxyManager ---');
    
    const mcpManager = new MockMcpManager();
    const logManager = new MockLogManager();
    const proxy = new McpProxyManager(mcpManager as any, logManager as any);

    // 1. Test Internal Tool Registration
    console.log('Test 1: Register Internal Tool');
    proxy.registerInternalTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {}
    }, async (args) => {
        return `Hello ${args.name}`;
    });

    // 2. Test Registry Refresh (should pick up internal tool)
    console.log('Test 2: Refresh Registry');
    // We need to access private method or rely on start/event. 
    // Since we can't easily access private methods in TS without casting, 
    // we'll rely on the fact that registerInternalTool updates the registry immediately now.
    
    // 3. Test Call Tool
    console.log('Test 3: Call Internal Tool');
    try {
        const result = await proxy.callTool('test_tool', { name: 'World' });
        console.log('Result:', JSON.stringify(result));
        if (result.content[0].text === 'Hello World') {
            console.log('✅ Internal Tool Call Passed');
        } else {
            console.error('❌ Internal Tool Call Failed');
        }
    } catch (e) {
        console.error('❌ Internal Tool Call Error:', e);
    }

    // 4. Test Missing Tool
    console.log('Test 4: Missing Tool');
    try {
        await proxy.callTool('missing_tool', {});
        console.error('❌ Missing Tool Test Failed (Should have thrown)');
    } catch (e: any) {
        if (e.message.includes('not found')) {
            console.log('✅ Missing Tool Test Passed');
        } else {
            console.error('❌ Missing Tool Test Failed (Wrong error):', e.message);
        }
    }
}

testProxy().catch(console.error);
