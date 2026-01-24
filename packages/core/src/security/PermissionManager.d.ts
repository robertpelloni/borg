export type AutonomyLevel = 'low' | 'medium' | 'high';
export declare class PermissionManager {
    autonomyLevel: AutonomyLevel;
    constructor(autonomyLevel?: AutonomyLevel);
    setAutonomyLevel(level: AutonomyLevel): void;
    getAutonomyLevel(): AutonomyLevel;
    /**
     * Determines if a tool call requires user approval.
     */
    checkPermission(toolName: string, args: any): 'APPROVED' | 'DENIED' | 'NEEDS_CONSULTATION';
    private assessRisk;
}
//# sourceMappingURL=PermissionManager.d.ts.map