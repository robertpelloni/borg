import { exec } from 'child_process';

export class HookExecutor {
    static async executeCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log(`Executing hook command: ${command}`);
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Hook execution failed: ${error.message}`);
                    return reject(error);
                }
                if (stderr) {
                    console.warn(`Hook stderr: ${stderr}`);
                }
                console.log(`Hook stdout: ${stdout}`);
                resolve(stdout);
            });
        });
    }
}
