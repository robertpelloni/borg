
import { AgentManager } from './packages/core/src/managers/AgentManager.ts';
import { McpManager } from './packages/core/src/managers/McpManager.ts';
import { MarketplaceManager } from './packages/core/src/managers/MarketplaceManager.ts';
import path from 'path';

async function testMarketplaceIntegration() {
    console.log('--- Testing Marketplace Integration ---');

    // Simulate standard boot sequence
    const rootDir = path.resolve('packages/core/src');
    const mcpDir = path.resolve('mcp-servers');

    const agentManager = new AgentManager(rootDir);
    const mcpManager = new McpManager(mcpDir);
    const marketplaceManager = new MarketplaceManager(rootDir);

    // Initialize
    marketplaceManager.initialize(agentManager, mcpManager);

    // Start Marketplace (which should start Skill Registry)
    await marketplaceManager.start();

    // Wait a bit for server to start
    await new Promise(r => setTimeout(r, 3000));

    // Check if server is running
    const servers = mcpManager.getAllServers();
    console.log('Running MCP Servers:', servers);

    const skillRegistry = servers.find(s => s.name === 'skill-registry');
    if (skillRegistry && skillRegistry.status === 'running') {
        console.log('✅ Skill Registry Server successfully started by Marketplace!');
        
        // Try to verify it's working by listing tools via the client?
        // McpManager creates a Client but doesn't expose it in getAllServers
        // Let's add a getter to McpManager to test this.
        const client = mcpManager.getClient('skill-registry');
        if (client) {
            try {
                const tools = await client.listTools();
                console.log('Available Tools:', tools.tools.map(t => t.name));
                if (tools.tools.find(t => t.name === 'execute_skill')) {
                    console.log('✅ execute_skill tool found!');
                }
            } catch (e) {
                console.error('Failed to list tools:', e);
            }
        }
    } else {
        console.error('❌ Skill Registry Server failed to start.');
    }
    
    // Cleanup
    await mcpManager.stopServer('skill-registry');
}

testMarketplaceIntegration().catch(console.error);
