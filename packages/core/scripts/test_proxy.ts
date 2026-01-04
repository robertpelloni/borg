
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

    // 5. Test Progressive Disclosure
    console.log('Test 5: Progressive Disclosure');
    // Force enable progressive mode for test
    (proxy as any).progressiveMode = true;
    
    const sessionId = 'test-session';
    
    // Initial State: Only Meta + Internal
    const initialTools = await proxy.getAllTools(sessionId);
    console.log('Initial Tools:', initialTools.map(t => t.name));
    if (initialTools.find(t => t.name === 'search_tools') && initialTools.find(t => t.name === 'test_tool')) {
        console.log('✅ Initial State Correct');
    } else {
        console.error('❌ Initial State Incorrect');
    }

    // Search
    const searchRes = await proxy.callTool('search_tools', { query: 'test' });
    console.log('Search Result:', JSON.parse(searchRes.content[0].text).length, 'matches');

    // Load Tool (Simulate loading a tool that exists in registry but not visible)
    // We need to mock a tool in the registry that isn't internal
    (proxy as any).toolRegistry.set('remote_tool', 'mock_server');
    (proxy as any).toolDefinitions.set('remote_tool', { name: 'remote_tool', description: 'Remote' });
    
    await proxy.callTool('load_tool', { name: 'remote_tool' }, sessionId);
    
    // Check visibility
    const newTools = await proxy.getAllTools(sessionId);
    console.log('New Tools:', newTools.map(t => t.name));
    if (newTools.find(t => t.name === 'remote_tool')) {
        console.log('✅ Tool Loaded Successfully');
    } else {
        console.error('❌ Tool Load Failed');
    }
}

testProxy().catch(console.error);
