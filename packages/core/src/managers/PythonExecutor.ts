import { spawn } from 'child_process';
import * as path from 'path';

export class PythonExecutor {
  constructor() {}

  async executeScript(scriptPath: string, args: string[] = [], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use the python from the environment.
      // In a real production environment, this should be configurable or sandboxed (Docker).
      const pythonProcess = spawn('python', [scriptPath, ...args], {
        cwd: cwd || path.dirname(scriptPath),
        env: process.env, // Inherit env for now (needed for gh auth etc)
        shell: true
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}\nErrors: ${errorOutput}`));
        } else {
          resolve(output);
        }
      });
      
      pythonProcess.on('error', (err) => {
          reject(err);
      });
    });
  }
}
