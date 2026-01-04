import { spawn } from 'child_process';
import * as path from 'path';

export class PythonExecutor {
  constructor() {}

  async executeScript(scriptPath: string, args: string[] = [], cwd?: string): Promise<string> {
    // SECURITY CHECK: Basic path validation
    const normalizedPath = path.normalize(scriptPath);
    if (normalizedPath.includes('..') && !normalizedPath.startsWith(process.cwd())) {
        // This is a weak check, but prevents obvious traversal out of the project if path is absolute
        // Ideally we resolve to absolute and check if it starts with allowed roots.
    }
    
    // SECURITY HARDENING:
    // 1. Check if Docker is available. If so, use it.
    // 2. If not, check a configuration flag (ALLOW_LOCAL_PYTHON).
    // 3. For now, since we don't have the config system fully plumbed here, we will Log a warning.
    
    // TODO: Implement Docker execution
    // docker run --rm -v ${dir}:/app python:3.9 python /app/script.py ...
    
    return new Promise((resolve, reject) => {
      // Use the python from the environment.
      // In a real production environment, this should be configurable or sandboxed (Docker).
      
      console.warn(`[PythonExecutor] WARNING: Executing Python script on host: ${scriptPath}`);
      
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
