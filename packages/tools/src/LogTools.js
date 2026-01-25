import fs from 'fs/promises';
import path from 'path';
import os from 'os';
const LOG_FILE_PATH = path.join(os.homedir(), '.borg', 'logs', 'supervisor.log');
export const LogTools = [
    {
        name: "read_supervisor_logs",
        description: "Read the last N lines of the Supervisor log",
        inputSchema: {
            type: "object",
            properties: {
                lines: { type: "number", description: "Number of lines to read (default: 50)" }
            }
        },
        handler: async (args) => {
            try {
                const lineCount = args.lines || 50;
                try {
                    await fs.access(LOG_FILE_PATH);
                }
                catch {
                    return { content: [{ type: "text", text: "Log file not found." }] };
                }
                const content = await fs.readFile(LOG_FILE_PATH, 'utf-8');
                const allLines = content.split('\n');
                const lastLines = allLines.slice(-lineCount);
                return { content: [{ type: "text", text: lastLines.join('\n') }] };
            }
            catch (err) {
                return { content: [{ type: "text", text: `Error reading logs: ${err.message}` }] };
            }
        }
    }
];
