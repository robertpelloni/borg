import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Basic Filesystem Tools
export const FileSystemTools = [
    {
        name: "list_files",
        description: "List files in a directory",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to list" }
            },
            required: ["path"]
        },
        handler: async (args: { path: string }) => {
            try {
                const files = await fs.readdir(args.path, { withFileTypes: true });
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(files.map(f => ({
                            name: f.name,
                            isDirectory: f.isDirectory()
                        })), null, 2)
                    }]
                };
            } catch (err: any) {
                return { content: [{ type: "text", text: `Error: ${err.message}` }] };
            }
        }
    },
    {
        name: "read_file",
        description: "Read file content",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to read" }
            },
            required: ["path"]
        },
        handler: async (args: { path: string }) => {
            try {
                const content = await fs.readFile(args.path, "utf-8");
                return { content: [{ type: "text", text: content }] };
            } catch (err: any) {
                return { content: [{ type: "text", text: `Error: ${err.message}` }] };
            }
        }
    },
    {
        name: "write_file",
        description: "Write content to a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to write" },
                content: { type: "string", description: "Content to write" }
            },
            required: ["path", "content"]
        },
        handler: async (args: { path: string, content: string }) => {
            try {
                await fs.mkdir(path.dirname(args.path), { recursive: true });
                await fs.writeFile(args.path, args.content, "utf-8");
                return { content: [{ type: "text", text: `Successfully wrote to ${args.path}` }] };
            } catch (err: any) {
                return { content: [{ type: "text", text: `Error: ${err.message}` }] };
            }
        }
    }
];
