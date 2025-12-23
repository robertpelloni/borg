import Fuse from 'fuse.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export class ToolSearchService {
    private fuse: Fuse<Tool>;
    private tools: Tool[] = [];

    constructor() {
        this.fuse = new Fuse([], {
            keys: ['name', 'description'],
            threshold: 0.4
        });
    }

    indexTools(tools: Tool[]) {
        this.tools = tools;
        this.fuse.setCollection(tools);
    }

    search(query: string): Tool[] {
        if (!query) return this.tools;
        return this.fuse.search(query).map(result => result.item);
    }
}
