import type { MCPServer } from "../MCPServer.js";
export declare class Director {
    private server;
    private llmService;
    private council;
    private lastSelection;
    private isAutoDriveActive;
    private currentStatus;
    private monitor;
    constructor(server: MCPServer);
    /**
     * Starts an autonomous task loop.
     * @param goal The high-level objective.
     * @param maxSteps Safety limit to prevent infinite loops.
     */
    executeTask(goal: string, maxSteps?: number): Promise<string>;
    /**
     * Starts a continuous watchdog loop to monitor Antigravity/Terminal state.
     */
    startWatchdog(maxCycles?: number): Promise<string>;
    /**
     * Starts a Chat Daemon that acts as a bridge.
     * It polls 'vscode_read_selection'. If text changes, it treats it as a prompt.
     */
    startChatDaemon(): Promise<string>;
    /**
     * Stops the Auto-Drive loop.
     */
    stopAutoDrive(): void;
    /**
     * Gets the current operational status.
     */
    getStatus(): {
        active: boolean;
        status: "IDLE" | "THINKING" | "DRIVING";
        goal: string;
    };
    /**
     * Starts the Self-Driving Mode.
     * 1. Reads task.md
     * 2. Finds next task.
     * 3. Submits to Chat.
     * 4. Auto-Accepts (via Smart Monitor).
     */
    startAutoDrive(): Promise<string>;
    /**
     * Starts the smart, state-aware auto-accepter.
     * Unlike the old "blind" clicker, this monitors the conversation state.
     */
    private startAutoAccepter;
    private think;
    private heuristicFallback;
}
//# sourceMappingURL=Director.d.ts.map