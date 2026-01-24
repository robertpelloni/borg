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

            return new Promise((resolve) => {
                // Use spawn to allow finer control
                // stdio: [stdin, stdout, stderr]
                // inherit stdin so user/simulator can type into the process
                const child = spawn(args.command, {
                    cwd: args.cwd,
                    shell: true,
                    stdio: ['inherit', 'pipe', 'pipe']
                });

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
                    const output = stdoutData + (stderrData ? `\nSTDERR:\n${stderrData}` : "");
                    resolve({ content: [{ type: "text", text: output.trim() || `Command exited with code ${code}` }] });
                });
            });
        }
    }
];
