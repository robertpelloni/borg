
import { ChildProcess } from 'child_process';

export class ProcessRegistry {
    private static activeProcesses: Map<string, ChildProcess> = new Map();

    static register(id: string, process: ChildProcess) {
        this.activeProcesses.set(id, process);
    }

    static unregister(id: string) {
        this.activeProcesses.delete(id);
    }

    static getLatest(): ChildProcess | undefined {
        // Return the most recently added process (heuristic)
        if (this.activeProcesses.size === 0) return undefined;
        return Array.from(this.activeProcesses.values()).pop();
    }
}
