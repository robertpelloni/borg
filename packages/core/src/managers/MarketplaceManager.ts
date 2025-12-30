import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { AgentManager } from './AgentManager.js';
import { McpManager } from './McpManager.js';

// Default mock registry
const MOCK_REGISTRY = [
    { name: "coder-agent", type: "agent", description: "An expert coding agent.", url: "https://example.com/coder.json" },
    { name: "writer-skill", type: "skill", description: "Creative writing skill.", url: "https://example.com/writer.md" }
];

export class MarketplaceManager extends EventEmitter {
    private packages: any[] = [];
    private registryUrl: string | null = null;
    private agentManager?: AgentManager;
    private mcpManager?: McpManager;

    constructor(private rootDir: string) {
        super();
        this.registryUrl = process.env.MCP_MARKETPLACE_URL || null;
    }

    // New initialization method to inject dependencies
    public initialize(agentManager: AgentManager, mcpManager: McpManager) {
        this.agentManager = agentManager;
        this.mcpManager = mcpManager;
    }

    async start() {
        // Automatically start the Skill Registry MCP Server
        if (this.mcpManager) {
             const skillServerPath = path.join(this.rootDir, 'bin/skill-registry-server.ts');
             
             // We need to resolve this path correctly.
             // rootDir is usually core/src or core/dist
             // bin is core/bin
             // If rootDir is core/src:
             const binPath = path.resolve(this.rootDir, '../bin/skill-registry-server.ts');
             
             await this.mcpManager.startServerSimple('skill-registry', {
                command: 'npx', 
                args: ['tsx', binPath],
                env: {
                    ...process.env,
                }
            });
            console.log('[MarketplaceManager] Started Skill Registry MCP Server');
        } else {
            console.warn('[MarketplaceManager] McpManager not initialized, skipping Skill Registry startup');
        }
    }

    async refresh() {
        if (this.registryUrl) {
            try {
                // In a real implementation, fetch from URL
                // const res = await fetch(this.registryUrl);
                // this.packages = await res.json();
                console.log(`[Marketplace] Fetching from ${this.registryUrl} (mocked)`);
                this.packages = MOCK_REGISTRY; // Mock for now
            } catch (e) {
                console.error('[Marketplace] Failed to fetch registry:', e);
                this.packages = MOCK_REGISTRY;
            }
        } else {
            this.packages = MOCK_REGISTRY;
        }
        this.emit('updated', this.packages);
    }

    getPackages() {
        return this.packages;
    }

    async installPackage(name: string) {
        const pkg = this.packages.find(p => p.name === name);
        if (!pkg) throw new Error(`Package ${name} not found`);

        const targetDir = pkg.type === 'agent' ? 'agents' : 'skills';
        const ext = pkg.type === 'agent' ? '.json' : '.skill.md';
        const targetPath = path.join(this.rootDir, targetDir, `${name}${ext}`);

        // Ensure dir exists
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        // Simulate download
        const content = pkg.type === 'agent'
            ? JSON.stringify({ name, description: pkg.description, instructions: "You are an expert." }, null, 2)
            : `# ${name}\n\n${pkg.description}`;

        fs.writeFileSync(targetPath, content);
        return `Installed ${name} to ${targetDir}/`;
    }
}
