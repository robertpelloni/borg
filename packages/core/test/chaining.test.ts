
import { McpProxyManager } from '../src/managers/McpProxyManager.js';
import { EventEmitter } from 'events';

// Mock McpManager
class MockMcpManager extends EventEmitter {
    getClient(name: string) {
        return null;
    }
    getAllServers() {
        return [];
    }
}

// Mock LogManager
class MockLogManager {
    log(entry: any) {
        // console.log('[MockLog]', entry.type, entry.tool);
    }
    calculateCost() {
        return 0;
    }
}

async function runTests() {
    console.log('Starting Chain Tests...');

    const mcpManager = new MockMcpManager() as any;
    const logManager = new MockLogManager() as any;
    const proxy = new McpProxyManager(mcpManager, logManager);

    // Disable MetaMCP connection for tests
    process.env.MCP_DISABLE_METAMCP = 'true';
    
    // Register mock tools
    proxy.registerInternalTool({
        name: "mock_echo",
        description: "Echoes input",
        inputSchema: { type: "object", properties: { message: { type: "string" } } }
    }, async (args: any) => {
        return { content: [{ type: "text", text: args.message }] };
    });

    proxy.registerInternalTool({
        name: "mock_reverse",
        description: "Reverses input string",
        inputSchema: { type: "object", properties: { input: { type: "string" } } }
    }, async (args: any) => {
        return { content: [{ type: "text", text: args.input.split('').reverse().join('') }] };
    });

    proxy.registerInternalTool({
        name: "mock_fail",
        description: "Always fails",
        inputSchema: { type: "object" }
    }, async (args: any) => {
        return { isError: true, content: [{ type: "text", text: "Intentional failure" }] };
    });

    await proxy.start();

    // Test 1: Successful Chain
    console.log('\nTest 1: Echo -> Reverse Chain');
    const chainResult = await proxy.callTool('mcp_chain', {
        mcpPath: [
            {
                toolName: "mock_echo",
                toolArgs: JSON.stringify({ message: "hello" })
            },
            {
                toolName: "mock_reverse",
                toolArgs: JSON.stringify({ input: "CHAIN_RESULT" })
            }
        ]
    });

    if (chainResult.content[0].text === 'olleh') { // Result is raw string if it's a string
        console.log('PASS: Got expected output "olleh"');
    } else {
        console.error('FAIL: Expected "olleh", got:', chainResult.content[0].text);
        process.exit(1);
    }

    // Test 2: Error Handling
    console.log('\nTest 2: Chain with Failure');
    const failResult = await proxy.callTool('mcp_chain', {
        mcpPath: [
            {
                toolName: "mock_echo",
                toolArgs: JSON.stringify({ message: "start" })
            },
            {
                toolName: "mock_fail",
                toolArgs: "{}"
            },
            {
                toolName: "mock_reverse",
                toolArgs: JSON.stringify({ input: "CHAIN_RESULT" })
            }
        ]
    });

    if (failResult.isError && failResult.content[0].text.includes("Chain failed at step 2")) {
        console.log('PASS: Chain stopped at failure step correctly.');
    } else {
        console.error('FAIL: Chain did not handle error correctly.', failResult);
        process.exit(1);
    }

    console.log('\nAll tests passed!');
}

runTests().catch(console.error);
