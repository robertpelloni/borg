import fs from "fs/promises";
import path from "path";
import os from "os";
// Hardcoded for now based on user context, ideally configurable
const ANTIGRAVITY_CONFIG_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'mcp.json');
export const ConfigTools = [
    {
        name: "read_antigravity_config",
        description: "Read the Antigravity MCP configuration",
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
            try {
                const content = await fs.readFile(ANTIGRAVITY_CONFIG_PATH, 'utf-8');
                return { content: [{ type: "text", text: content }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Error reading config: ${err.message}` }] };
            }
        }
    },
    {
        name: "write_antigravity_config",
        description: "Write to the Antigravity MCP configuration",
        inputSchema: {
            type: "object",
            properties: {
                content: { type: "string", description: "JSON content" }
            },
            required: ["content"]
        },
        handler: async (args) => {
            try {
                // validate JSON
                JSON.parse(args.content);
                // Backup first
                const backupPath = `${ANTIGRAVITY_CONFIG_PATH}.bak.${Date.now()}`;
                await fs.copyFile(ANTIGRAVITY_CONFIG_PATH, backupPath);
                await fs.writeFile(ANTIGRAVITY_CONFIG_PATH, args.content, 'utf-8');
                return { content: [{ type: "text", text: `Config updated. Backup saved to ${backupPath}` }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Error writing config: ${err.message}` }] };
            }
        }
    }
];
