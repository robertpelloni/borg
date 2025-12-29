import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { SecretManager } from './SecretManager.js';
import { MemoryProvider, Memory, MemoryResult } from '../interfaces/MemoryProvider.js';
import { LocalFileProvider } from './providers/LocalFileProvider.js';
import { Mem0Provider } from './providers/Mem0Provider.js';
import { PineconeMemoryProvider } from './providers/PineconeMemoryProvider.js';
import { BrowserStorageProvider } from './providers/BrowserStorageProvider.js';
import { ContextCompactor } from './ContextCompactor.js';
import { JulesIngestor } from '../ingestors/JulesIngestor.js';
import { AgentExecutor } from '../agents/AgentExecutor.js';
import { BrowserManager } from './BrowserManager.js';

import { AgentMessage } from '../interfaces/AgentInterfaces.js';

export class MemoryManager {
    private providers: Map<string, MemoryProvider> = new Map();
    private defaultProviderId: string = 'default-file';
    private snapshotDir: string;
    private openai?: OpenAI;
    private compactor?: ContextCompactor;
    private julesIngestor?: JulesIngestor;
    private browserProvider?: BrowserStorageProvider;

    constructor(
        dataDir: string, 
        private secretManager?: SecretManager,
        agentExecutor?: AgentExecutor
    ) {
        this.snapshotDir = path.join(dataDir, 'snapshots');
        
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }

        if (agentExecutor) {
            this.compactor = new ContextCompactor(agentExecutor);
        }

        // Initialize Default Provider
        const fileProvider = new LocalFileProvider(dataDir);
        // Synchronously register default provider to ensure immediate availability
        this.providers.set(fileProvider.id, fileProvider);
        fileProvider.init().catch(e => console.error(`[Memory] Failed to init default provider:`, e));
        console.log(`[Memory] Registered provider: ${fileProvider.name}`);

        this.initOpenAI();
        this.detectExternalProviders();
    }

    async ingestAgentMessage(message: AgentMessage) {
        if (!this.compactor) return;
        
        const content = `From: ${message.sourceAgentId}\nTo: ${message.targetAgentId}\nType: ${message.type}\nContent: ${message.content}`;
        
        try {
            const compacted = await this.compactor.compact(content, 'conversation');
            
            if (compacted.facts.length > 0) {
                await this.remember({ 
                    content: `[Auto-Fact] ${compacted.facts.join('; ')}`, 
                    tags: ['auto-generated', 'fact', 'agent-message', message.sourceAgentId] 
                });
            }
            if (compacted.decisions.length > 0) {
                await this.remember({ 
                    content: `[Auto-Decision] ${compacted.decisions.join('; ')}`, 
                    tags: ['auto-generated', 'decision', 'agent-message', message.sourceAgentId] 
                });
            }
             if (compacted.actionItems.length > 0) {
                await this.remember({ 
                    content: `[Auto-Action] ${compacted.actionItems.join('; ')}`, 
                    tags: ['auto-generated', 'action-item', 'agent-message', message.sourceAgentId] 
                });
            }
        } catch (e) {
            console.error('[Memory] Failed to ingest agent message:', e);
        }
    }

    async ingestInteraction(tool: string, args: any, result: any) {
        if (!this.compactor) return;

        // Filter out trivial interactions
        if (tool === 'search_memory' || tool === 'remember') return;

        const content = `Tool: ${tool}\nArgs: ${JSON.stringify(args)}\nResult: ${JSON.stringify(result)}`;
        
        try {
            const compacted = await this.compactor.compact(content, 'tool_output');
            
            // Store extracted facts/decisions
            if (compacted.facts.length > 0) {
                await this.remember({ 
                    content: `[Auto-Fact] ${compacted.facts.join('; ')}`, 
                    tags: ['auto-generated', 'fact', tool] 
                });
            }
            if (compacted.decisions.length > 0) {
                await this.remember({ 
                    content: `[Auto-Decision] ${compacted.decisions.join('; ')}`, 
                    tags: ['auto-generated', 'decision', tool] 
                });
            }
        } catch (e) {
            console.error('[Memory] Failed to ingest interaction:', e);
        }
    }

    async ingestSession(source: string, content: string) {
        if (!this.compactor) return "Context Compactor not available";

        const compacted = await this.compactor.compact(content, 'conversation');
        
        const summaryId = await this.remember({
            content: `[Session Summary - ${source}] ${compacted.summary}`,
            tags: ['session-summary', source]
        });

        return {
            summaryId,
            facts: compacted.facts.length,
            decisions: compacted.decisions.length
        };
    }

    private async detectExternalProviders() {
        // 1. Check for Mem0
        const mem0Key = this.secretManager?.getSecret('MEM0_API_KEY') || process.env.MEM0_API_KEY;
        if (mem0Key) {
            console.log('[Memory] Detected Mem0 API Key, initializing provider...');
            const mem0 = new Mem0Provider(mem0Key);
            await this.registerProvider(mem0);
        }

        // 2. Check for Pinecone
        const pineconeKey = this.secretManager?.getSecret('PINECONE_API_KEY') || process.env.PINECONE_API_KEY;
        const pineconeIndex = this.secretManager?.getSecret('PINECONE_INDEX') || process.env.PINECONE_INDEX;
        if (pineconeKey && pineconeIndex) {
            console.log('[Memory] Detected Pinecone API Key, initializing provider...');
            const pinecone = new PineconeMemoryProvider(pineconeKey, pineconeIndex);
            await this.registerProvider(pinecone);
        }

        // 3. Check for Docker Containers (Mock logic for now)
        // In a real implementation, we'd use Dockerode to list containers
        // if (docker.hasContainer('chroma')) ...

        // 3. Initialize Jules Ingestor
        const julesKey = this.secretManager?.getSecret('JULES_API_KEY') || process.env.JULES_API_KEY;
        if (julesKey) {
            console.log('[Memory] Detected Jules API Key, initializing ingestor...');
            this.julesIngestor = new JulesIngestor(this, julesKey);
        }
    }

    public async registerProvider(provider: MemoryProvider) {
        try {
            await provider.init();
            this.providers.set(provider.id, provider);
            console.log(`[Memory] Registered provider: ${provider.name}`);
        } catch (e) {
            console.error(`[Memory] Failed to register provider ${provider.name}:`, e);
        }
    }

    public setBrowserManager(browserManager: BrowserManager) {
        this.browserProvider = new BrowserStorageProvider(browserManager);
        this.registerProvider(this.browserProvider);
    }

    private initOpenAI() {
        if (this.secretManager) {
            const apiKey = this.secretManager.getSecret('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
            if (apiKey) {
                this.openai = new OpenAI({ apiKey });
            }
        }
    }

    async remember(args: { content: string, tags?: string[], providerId?: string }): Promise<string> {
        const providerId = args.providerId || this.defaultProviderId;
        const provider = this.providers.get(providerId);
        
        if (!provider) throw new Error(`Provider ${providerId} not found`);

        // Generate embedding if OpenAI is available and provider is local file (which needs help)
        let embedding: number[] | undefined;
        if (this.openai && provider instanceof LocalFileProvider) {
             embedding = await this.generateEmbedding(args.content);
        }

        const item: Memory = {
            id: Math.random().toString(36).substring(7),
            content: args.content,
            tags: args.tags || [],
            timestamp: Date.now(),
            embedding
        };

        await provider.store(item);
        return item.id;
    }

    async search(args: { query: string, providerId?: string }) {
        // Generate embedding once if possible
        let embedding: number[] | undefined;
        if (this.openai) {
            embedding = await this.generateEmbedding(args.query);
        }

        // Helper to search a single provider
        const searchProvider = async (provider: MemoryProvider) => {
             try {
                return await provider.search(args.query, 5, embedding);
            } catch (e) {
                console.error(`[Memory] Search failed for ${provider.name}:`, e);
                return [];
            }
        };

        // If provider specified, search only that
        if (args.providerId) {
            const provider = this.providers.get(args.providerId);
            if (!provider) return [];
            return await searchProvider(provider);
        }

        // Otherwise, search ALL providers and aggregate
        const allResults: MemoryResult[] = [];
        for (const provider of this.providers.values()) {
            const results = await searchProvider(provider);
            allResults.push(...results);
        }
        return allResults;
    }

    // Legacy method for backward compatibility
    async searchSemantic(args: { query: string, limit?: number }) {
        return this.search({ query: args.query });
    }

    async recall(args: { limit?: number, providerId?: string }) {
        const providerId = args.providerId || this.defaultProviderId;
        const provider = this.providers.get(providerId);
        
        if (provider instanceof LocalFileProvider) {
             // FileProvider specific method, or we add getAll to interface
             const all = await provider.getAll();
             return all.slice(-(args.limit || 10));
        }
        return "Recall not supported on this provider";
    }

    // ... (Keep existing snapshot methods unchanged) ...
    async createSnapshot(args: { sessionId: string, context: any }) {
        const snapshotPath = path.join(this.snapshotDir, `${args.sessionId}_${Date.now()}.json`);
        try {
            fs.writeFileSync(snapshotPath, JSON.stringify(args.context, null, 2));
            return `Snapshot created at ${snapshotPath}`;
        } catch (e) {
            throw new Error(`Failed to create snapshot: ${e}`);
        }
    }

    async listSnapshots(args: { sessionId?: string }) {
        try {
            const files = fs.readdirSync(this.snapshotDir);
            return files
                .filter(f => !args.sessionId || f.startsWith(args.sessionId))
                .map(f => ({ filename: f, path: path.join(this.snapshotDir, f) }));
        } catch (e) {
            return [];
        }
    }

    async restoreSnapshot(args: { filename: string }) {
        const snapshotPath = path.join(this.snapshotDir, args.filename);
        if (!fs.existsSync(snapshotPath)) {
            throw new Error(`Snapshot not found: ${args.filename}`);
        }
        return JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    }

    async backfillEmbeddings() {
        // Only relevant for FileProvider currently
        const provider = this.providers.get('default-file');
        if (provider instanceof LocalFileProvider && this.openai) {
             // Logic to iterate and update would go here
             // For now, we'll skip complex backfill logic in this refactor
             return "Backfill not implemented for multi-provider yet";
        }
        return "No suitable provider for backfill";
    }

    private async generateEmbedding(text: string): Promise<number[] | undefined> {
        if (!this.openai) return undefined;
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            return response.data[0].embedding;
        } catch (e) {
            console.error('[Memory] Failed to generate embedding:', e);
            return undefined;
        }
    }

    async syncJulesSessions() {
        if (!this.julesIngestor) return "Jules Ingestor not initialized (missing API key)";
        return await this.julesIngestor.syncSessions();
    }

    async exportMemory(filePath: string) {
        const exportData: any = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            items: []
        };

        for (const provider of this.providers.values()) {
            if (provider.getAll) {
                try {
                    const items = await provider.getAll();
                    exportData.items.push(...items.map(item => ({
                        ...item,
                        sourceProvider: provider.id
                    })));
                } catch (e) {
                    console.error(`[Memory] Failed to export from ${provider.name}:`, e);
                }
            }
        }

        try {
            fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
            return `Memory exported to ${filePath} (${exportData.items.length} items)`;
        } catch (e: any) {
            return `Failed to write export file: ${e.message}`;
        }
    }

    async importMemory(filePath: string) {
        if (!fs.existsSync(filePath)) return `File not found: ${filePath}`;
        
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (!data.items || !Array.isArray(data.items)) return "Invalid export format";

            const provider = this.providers.get(this.defaultProviderId);
            if (!provider) return "Default provider not found";

            // Filter out items that might already exist? Or just let provider handle it?
            // For now, we just insert.
            let count = 0;
            for (const item of data.items) {
                // Strip sourceProvider before inserting if needed, or keep it as metadata
                const { sourceProvider, ...memoryItem } = item;
                await provider.store(memoryItem);
                count++;
            }
            return `Imported ${count} items from ${filePath}`;
        } catch (e: any) {
            return `Failed to import memory: ${e.message}`;
        }
    }

    getProviders() {
        return Array.from(this.providers.values()).map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            capabilities: p.capabilities
        }));
    }

    getToolDefinitions() {
        return [
            {
                name: "remember",
                description: "Store a new memory or fact.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: { type: "string" },
                        tags: { type: "array", items: { type: "string" } },
                        providerId: { type: "string", description: "Optional: Target specific memory provider" }
                    },
                    required: ["content"]
                }
            },
            {
                name: "search_memory",
                description: "Search stored memories across all providers.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string" },
                        providerId: { type: "string" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "list_memory_providers",
                description: "List available memory providers (File, Mem0, Pinecone, etc).",
                inputSchema: { type: "object", properties: {} }
            },
            // ... Snapshot tools ...
            {
                name: "create_snapshot",
                description: "Save the current session context to a snapshot file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string" },
                        context: { type: "object" }
                    },
                    required: ["sessionId", "context"]
                }
            },
            {
                name: "list_snapshots",
                description: "List available session snapshots.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string" }
                    }
                }
            },
            {
                name: "restore_snapshot",
                description: "Restore context from a snapshot file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filename: { type: "string" }
                    },
                    required: ["filename"]
                }
            },
            {
                name: "ingest_content",
                description: "Ingest and summarize content from an external source (e.g., chat transcript, documentation).",
                inputSchema: {
                    type: "object",
                    properties: {
                        source: { type: "string", description: "Source identifier (e.g., 'VSCode Session', 'Jules')" },
                        content: { type: "string", description: "The raw text content to ingest." }
                    },
                    required: ["source", "content"]
                }
            },
            {
                name: "sync_jules_sessions",
                description: "Sync and ingest recent sessions from Jules.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "export_memory",
                description: "Export all memories to a JSON file (e.g., for git backup).",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string", description: "Absolute path to save the export file." }
                    },
                    required: ["filePath"]
                }
            },
            {
                name: "import_memory",
                description: "Import memories from a JSON export file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string", description: "Absolute path to the export file." }
                    },
                    required: ["filePath"]
                }
            }
        ];
    }
}
