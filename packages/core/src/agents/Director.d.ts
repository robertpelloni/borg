import type { IMCPServer } from "../adk/AgentInterfaces.js";
export declare class Director {
    private server;
    private llmService;
    private council;
    private lastSelection;
    private isAutoDriveActive;
    private currentStatus;
    private monitor;
    constructor(server: IMCPServer);
    /**
     * Executes a single goal using the Director's reasoning loop.
     */
    executeTask(goal: string, maxSteps?: number): Promise<string>;
    /**
     * Starts the Autonomous Loop.
     * Unlike before, this DOES NOT rely on the Chat Input Box.
     * It runs internally and posts updates to Chat.
     */
    startAutoDrive(): Promise<string>;
    stopAutoDrive(): void;
    /**
     * The heartbeat of Autonomy.
     * Checks for "Needs Approval" (Terminal) or "Idle" (Needs Direction).
     */
    private startMonitor;
    private broadcast;
    private think;
    private heuristicFallback;
    getIsActive(): boolean;
}
//# sourceMappingURL=Director.d.ts.map