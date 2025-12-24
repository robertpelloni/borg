import Fuse from 'fuse.js';

export interface ToolDefinition {
    name: string;
    description?: string;
    [key: string]: any;
}

export class ToolSearchService {
    private fuse: Fuse<ToolDefinition>;
    private tools: ToolDefinition[] = [];

    constructor() {
        this.fuse = new Fuse([], {
            keys: ['name', 'description'],
            threshold: 0.4
        });
    }

    setTools(tools: ToolDefinition[]) {
        this.tools = tools;
        this.fuse.setCollection(tools);
    }

    search(query: string, limit = 5): ToolDefinition[] {
        const results = this.fuse.search(query);
        return results.slice(0, limit).map(r => r.item);
    }
}
