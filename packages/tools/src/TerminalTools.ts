
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export const TerminalTools = [
    {
        name: "execute_command",
        description: "Execute a shell command",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Command to execute" },
                cwd: { type: "string", description: "Working directory (optional)" }
            },
            required: ["command"]
        },
        handler: async (args: { command: string, cwd?: string }) => {
            const { spawn } = await import("child_process");
            // @ts-ignore
            const { ProcessRegistry } = await import("../os/ProcessRegistry.js");

            return new Promise((resolve) => {
                // Use spawn to allow finer control
                // stdio: ['pipe', 'pipe', 'pipe'] allows us to write to stdin via code
                // BUT we also want user to type?
                // We pipe parent stdin to child stdin.
                const child = spawn(args.command, {
                    cwd: args.cwd,
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                // Pipe Parent Stdin (User keys) to Child Stdin
                if (process.stdin && child.stdin) {
                    process.stdin.pipe(child.stdin);
                    // Do not close child stdin on parent end? 
                    // process.stdin.on('end', () => child.stdin.end());
                }

                // Track process for Direct Input Injection (Agent keys)
                ProcessRegistry.register('latest', child);

                let stdoutData = "";
                let stderrData = "";

                if (child.stdout) {
                    child.stdout.on('data', (d) => { stdoutData += d.toString(); });
                }
                if (child.stderr) {
                    child.stderr.on('data', (d) => { stderrData += d.toString(); });
                }

                child.on('error', (err) => {
                    resolve({ content: [{ type: "text", text: `Error: ${err.message}` }] });
                });

                child.on('close', (code) => {
                    // @ts-ignore
                    ProcessRegistry.unregister('latest');
                    // Unpipe to prevent leak?
                    if (process.stdin) process.stdin.unpipe(child.stdin);

                    const output = stdoutData + (stderrData ? `\nSTDERR:\n${stderrData}` : "");
                    resolve({ content: [{ type: "text", text: output.trim() || `Command exited with code ${code}` }] });
                });
            });
        }
    }
];
