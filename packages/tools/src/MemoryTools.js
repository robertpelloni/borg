import fs from "fs/promises";
import path from "path";
import os from "os";
const MEMORY_DIR = path.join(os.homedir(), '.borg', 'memory');
async function ensureMemoryDir() {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
}
export const MemoryTools = [
    {
        name: "store_memory",
        description: "Store a piece of long-term memory (preference, fact, project info)",
        inputSchema: {
            type: "object",
            properties: {
                key: { type: "string", description: "Unique key/title for the memory" },
                value: { type: "string", description: "The content to store" },
                tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" }
            },
            required: ["key", "value"]
        },
        handler: async (args) => {
            try {
                await ensureMemoryDir();
                const safeKey = args.key.replace(/[^a-zA-Z0-9-]/g, '_');
                const filePath = path.join(MEMORY_DIR, `${safeKey}.json`);
                const memoryObject = {
                    key: args.key,
                    value: args.value,
                    tags: args.tags || [],
                    timestamp: new Date().toISOString()
                };
                await fs.writeFile(filePath, JSON.stringify(memoryObject, null, 2), "utf-8");
                return { content: [{ type: "text", text: `Memory stored: ${filePath}` }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Error storing memory: ${err.message}` }] };
            }
        }
    },
    {
        name: "retrieve_memory",
        description: "Retrieve a memory by key",
        inputSchema: {
            type: "object",
            properties: {
                key: { type: "string", description: "The key of the memory to retrieve" }
            },
            required: ["key"]
        },
        handler: async (args) => {
            try {
                const safeKey = args.key.replace(/[^a-zA-Z0-9-]/g, '_');
                const filePath = path.join(MEMORY_DIR, `${safeKey}.json`);
                const content = await fs.readFile(filePath, "utf-8");
                return { content: [{ type: "text", text: content }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Memory not found or error: ${err.message}` }] };
            }
        }
    },
    {
        name: "list_memories",
        description: "List all stored memory keys",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
            try {
                await ensureMemoryDir();
                const files = await fs.readdir(MEMORY_DIR);
                const jsonFiles = files.filter(f => f.endsWith('.json'));
                return { content: [{ type: "text", text: JSON.stringify(jsonFiles, null, 2) }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Error listing memories: ${err.message}` }] };
            }
        }
    }
];
