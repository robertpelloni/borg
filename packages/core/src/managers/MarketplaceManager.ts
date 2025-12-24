import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Default mock registry
const MOCK_REGISTRY = [
    { name: "coder-agent", type: "agent", description: "An expert coding agent.", url: "https://example.com/coder.json" },
    { name: "writer-skill", type: "skill", description: "Creative writing skill.", url: "https://example.com/writer.md" }
];

export class MarketplaceManager extends EventEmitter {
    private packages: any[] = [];
    private registryUrl: string | null = null;

    constructor(private rootDir: string) {
        super();
        this.registryUrl = process.env.MCP_MARKETPLACE_URL || null;
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
