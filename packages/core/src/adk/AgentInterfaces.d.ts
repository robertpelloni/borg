/**
 * Agent Development Kit (ADK) Interfaces
 * Compatible with Google's Agent ecosystem.
 */
export interface Agent {
    id: string;
    name: string;
    capabilities: Capability[];
    execute(task: Task): Promise<Result>;
}
export interface Capability {
    name: string;
    description: string;
    schema: any;
}
export interface Task {
    id: string;
    goal: string;
    context: Record<string, any>;
}
export interface Result {
    success: boolean;
    output: any;
    artifacts: string[];
}
export interface IModelSelector {
    selectModel(constraints: any): Promise<any>;
}
export interface IPermissionManager {
    checkPermission(tool: string, args: any): string;
    getAutonomyLevel(): string;
    setAutonomyLevel(level: string): void;
}
export interface IMCPServer {
    modelSelector: IModelSelector;
    permissionManager: IPermissionManager;
    executeTool(name: string, args: any): Promise<any>;
}
//# sourceMappingURL=AgentInterfaces.d.ts.map