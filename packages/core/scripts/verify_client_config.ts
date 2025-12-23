import { ClientManager } from '../src/managers/ClientManager.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function main() {
    console.log('Verifying Client Configuration Injection...');

    const tmpDir = os.tmpdir();
    const mockConfigPath = path.join(tmpDir, 'mock-mcp-servers.json');

    // Create a mock client config
    fs.writeFileSync(mockConfigPath, JSON.stringify({
        mcpServers: {
            "existing-server": { command: "echo" }
        }
    }, null, 2));

    const clientManager = new ClientManager([
        { name: 'MockClient', paths: [mockConfigPath] }
    ]);

    const clients = clientManager.getClients();
    console.log('Detected Clients:', clients);

    const mockClient = clients.find(c => c.name === 'MockClient');
    if (!mockClient || !mockClient.exists) {
        throw new Error('Failed to detect mock client');
    }

    console.log('Configuring MockClient...');
    const scriptPath = '/abs/path/to/dist/index.js';
    await clientManager.configureClient('MockClient', {
        scriptPath,
        env: { MCP_STDIO_ENABLED: 'true' }
    });

    const updatedConfig = JSON.parse(fs.readFileSync(mockConfigPath, 'utf-8'));
    console.log('Updated Config:', JSON.stringify(updatedConfig, null, 2));

    if (!updatedConfig.mcpServers['super-ai-hub']) {
        throw new Error('super-ai-hub entry missing');
    }

    if (updatedConfig.mcpServers['super-ai-hub'].args[0] !== scriptPath) {
        throw new Error('Incorrect script path injected');
    }

    console.log('Verification Successful!');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
