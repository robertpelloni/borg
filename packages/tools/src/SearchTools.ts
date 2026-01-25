
import { rgPath } from '@vscode/ripgrep';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

export const SearchTools = [
    {
        name: "search_codebase",
        description: "Search the codebase using Ripgrep (Fast Text Search)",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Text or Regex to search for" },
                path: { type: "string", description: "Directory to search (default: cwd)" },
                filePattern: { type: "string", description: "File glob pattern (e.g. *.ts)" }
            },
            required: ["query"]
        },
        handler: async (args: { query: string, path?: string, filePattern?: string }) => {
            try {
                const searchPath = args.path || process.cwd();
                const globArgs = args.filePattern ? `-g "${args.filePattern}"` : "";

                // Construct command: rg --line-number --with-filename <query> <path>
                const command = `"${rgPath}" --line-number --with-filename --no-heading ${globArgs} "${args.query}" "${searchPath}"`;

                // Limit output to prevent overflow
                const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

                return { content: [{ type: "text", text: stdout.trim() || "No matches found." }] };
            } catch (err: any) {
                // Ripgrep exits with 1 if no matches found
                if (err.code === 1) return { content: [{ type: "text", text: "No matches found." }] };
                return { content: [{ type: "text", text: `Search Error: ${err.message}` }] };
            }
        }
    }
];
