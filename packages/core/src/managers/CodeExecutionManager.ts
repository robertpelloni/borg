import { SandboxManager } from './SandboxManager.js';
import { PythonExecutor } from './PythonExecutor.js';

export class CodeExecutionManager {
    private pythonExecutor: PythonExecutor;

    constructor() {
        this.pythonExecutor = new PythonExecutor();
    }

    async execute(code: string, toolCallback: (name: string, args: any) => Promise<any>, sessionId?: string): Promise<string> {
        const sandbox = new SandboxManager();
        try {
            const result = await sandbox.execute(code, toolCallback);
            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (e: any) {
            return `Error: ${e.message}`;
        } finally {
            sandbox.dispose();
        }
    }

    async executePythonScript(scriptPath: string, args: string[] = []): Promise<string> {
        return await this.pythonExecutor.executeScript(scriptPath, args);
    }
}

