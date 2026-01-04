import { AgentDefinition } from '../types.js';

export interface AgentAdapter {
    parse(filepath: string, content: string): Promise<AgentDefinition | null>;
}
