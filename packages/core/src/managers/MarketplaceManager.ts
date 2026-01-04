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
        // Load the local registry on startup
        this.loadLocalRegistry();
    }

    private loadLocalRegistry() {
        try {
            // resolve path to data/skills_registry.json
            // Assuming rootDir is .../packages/core/dist or .../packages/core/src
            // We need to go up to packages/core/data
            // If rootDir is the project root (C:\Users\hyper\workspace\aios), we adjust.
            // Based on usage in MarketplaceManager.ts:39 (path.resolve(this.rootDir, '../bin/skill-registry-server.ts')),
            // it seems rootDir passed in might be 'src' or 'dist' inside 'packages/core'.
            // Let's try to find it relative to the package root.
            
            // However, looking at the code, rootDir is passed in.
            // Let's assume rootDir is packages/core/src based on previous context or packages/core root.
            // Safest is to try a few paths or use the absolute path we know exists for now, 
            // but ideally relative to this file.
            
            const registryPath = path.resolve(this.rootDir, '../../data/skills_registry.json');
            if (fs.existsSync(registryPath)) {
                 const data = fs.readFileSync(registryPath, 'utf-8');
                 const skills = JSON.parse(data);
                 // Map to package format
                 this.packages = skills.map((s: any) => ({
                     name: s.name,
                     type: 'skill', // Registry currently only has skills
                     description: s.description,
                     path: s.path, // Keep the local path
                     metadata: s.metadata,
                     provider: s.provider
                 }));
                 console.log(`[MarketplaceManager] Loaded ${this.packages.length} skills from local registry`);
            } else {
                console.warn(`[MarketplaceManager] Registry not found at ${registryPath}`);
                this.packages = MOCK_REGISTRY;
            }
        } catch (e) {
            console.error('[MarketplaceManager] Failed to load local registry:', e);
            this.packages = MOCK_REGISTRY;
        }
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
        // For skills, we use the 'installed' subdirectory
        const installBase = pkg.type === 'skill' 
            ? path.join(this.rootDir, '../../skills/installed') 
            : path.join(this.rootDir, targetDir);
            
        const targetPath = path.join(installBase, name);

        // Ensure dir exists
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        // If it's a local path (from our registry), we "install" by copying or symlinking.
        // For now, let's copy to simulate installation and keep it self-contained.
        if (pkg.path && fs.existsSync(pkg.path)) {
             // It's a local directory from the submodules
             // We use fs.cpSync (Node 16.7+)
             try {
                 fs.cpSync(pkg.path, targetPath, { recursive: true });
                 return `Installed ${name} to ${targetPath}`;
             } catch (e: any) {
                 throw new Error(`Failed to install ${name}: ${e.message}`);
             }
        }

        // Fallback for mocked/remote packages
        const ext = pkg.type === 'agent' ? '.json' : '.skill.md';
        const fileTargetPath = path.join(installBase, `${name}${ext}`);
        
        // Simulate download
        const content = pkg.type === 'agent'
            ? JSON.stringify({ name, description: pkg.description, instructions: "You are an expert." }, null, 2)
            : `# ${name}\n\n${pkg.description}`;

        fs.writeFileSync(fileTargetPath, content);
        return `Installed ${name} to ${fileTargetPath}`;
    }
}
