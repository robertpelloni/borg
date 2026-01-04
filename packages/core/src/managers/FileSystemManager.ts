import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { glob } from 'glob';

const execAsync = util.promisify(exec);

export class FileSystemManager {
    constructor(private rootDir: string) {}

    private resolvePath(filePath: string): string {
        // Ensure path is absolute or relative to rootDir
        return path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    }

    async readFile(filePath: string): Promise<string> {
        const fullPath = this.resolvePath(filePath);
        try {
            return await fs.readFile(fullPath, 'utf-8');
        } catch (error: any) {
            return `Error reading file ${filePath}: ${error.message}`;
        }
    }

    async writeFile(filePath: string, content: string): Promise<string> {
        const fullPath = this.resolvePath(filePath);
        try {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');
            return `Successfully wrote to ${filePath}`;
        } catch (error: any) {
            return `Error writing file ${filePath}: ${error.message}`;
        }
    }

    async editFile(filePath: string, oldString: string, newString: string, replaceAll: boolean = false): Promise<string> {
        const fullPath = this.resolvePath(filePath);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            
            if (!content.includes(oldString)) {
                return `Error: oldString not found in ${filePath}`;
            }

            if (!replaceAll && content.indexOf(oldString) !== content.lastIndexOf(oldString)) {
                return `Error: oldString found multiple times in ${filePath}. Use replaceAll=true or provide more context.`;
            }

            const newContent = replaceAll 
                ? content.split(oldString).join(newString)
                : content.replace(oldString, newString);

            await fs.writeFile(fullPath, newContent, 'utf-8');
            return `Successfully edited ${filePath}`;
        } catch (error: any) {
            return `Error editing file ${filePath}: ${error.message}`;
        }
    }

    async executeCommand(command: string, timeout: number = 30000): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(command, { 
                cwd: this.rootDir,
                timeout 
            });
            return stdout || stderr || 'Command executed successfully (no output)';
        } catch (error: any) {
            return `Error executing command: ${error.message}\n${error.stderr || ''}`;
        }
    }

    async globSearch(pattern: string, cwd?: string): Promise<string[]> {
        try {
            const searchDir = cwd ? this.resolvePath(cwd) : this.rootDir;
            const files = await glob(pattern, { cwd: searchDir });
            // Ensure files are returned as strings and map them
            return (files as string[]).map((f: string) => cwd ? path.join(cwd, f) : f);
        } catch (error: any) {
            throw new Error(`Glob search failed: ${error.message}`);
        }
    }

    async grepSearch(pattern: string, searchPath?: string, include?: string): Promise<string> {
        try {
            const cwd = searchPath ? this.resolvePath(searchPath) : this.rootDir;
            const globPattern = include || '**/*';
            
            const files = await glob(globPattern, { 
                cwd, 
                nodir: true,
                ignore: ['**/node_modules/**', '**/.git/**'] 
            });

            const regex = new RegExp(pattern);
            const results: string[] = [];

            // Limit to first 100 files to prevent performance issues in this basic implementation
            for (const file of (files as string[]).slice(0, 100)) {
                const fullPath = path.join(cwd, file);
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const lines = content.split('\n');
                    
                    lines.forEach((line, index) => {
                        if (regex.test(line)) {
                            results.push(`${file}:${index + 1}: ${line.trim()}`);
                        }
                    });
                } catch (readError) {
                    // Ignore read errors for individual files (e.g. binary files)
                }
            }

            return results.join('\n') || 'No matches found';
        } catch (error: any) {
            return `Grep search failed: ${error.message}`;
        }
    }
}
