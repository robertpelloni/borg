/**
 * AIOS Tool Set Manager
 * 
 * Manages curated collections of MCP tools for different workflows and use cases.
 * 
 * Features:
 * - Create and manage tool sets (collections)
 * - Quick loading of tool sets into sessions
 * - Built-in templates for common workflows
 * - Export/import tool sets
 * 
 * @module managers/ToolSetManager
 */

import { EventEmitter } from 'events';

// ============================================
// Types & Interfaces
// ============================================

export interface ToolSetItem {
    toolName: string;
    serverName?: string;
    description?: string;
    required?: boolean;
}

export interface ToolSet {
    id: string;
    name: string;
    description: string;
    items: ToolSetItem[];
    tags: string[];
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
}

export interface ToolSetTemplate {
    id: string;
    name: string;
    description: string;
    items: ToolSetItem[];
    tags: string[];
}

// ============================================
// Tool Set Manager Class
// ============================================

export class ToolSetManager extends EventEmitter {
    private toolSets: Map<string, ToolSet> = new Map();
    private templates: Map<string, ToolSetTemplate> = new Map();

    constructor() {
        super();
        this.initializeTemplates();
    }

    /**
     * Initialize built-in templates
     */
    private initializeTemplates(): void {
        const builtInTemplates: ToolSetTemplate[] = [
            {
                id: 'development',
                name: 'Development Tools',
                description: 'Essential tools for software development',
                items: [
                    { toolName: 'read_file', description: 'Read file contents', required: true },
                    { toolName: 'write_file', description: 'Write file contents', required: true },
                    { toolName: 'list_directory', description: 'List directory contents', required: true },
                    { toolName: 'search_files', description: 'Search files by pattern' },
                    { toolName: 'execute_command', description: 'Execute shell commands' },
                    { toolName: 'git_status', description: 'Git status' },
                    { toolName: 'git_diff', description: 'Git diff' },
                    { toolName: 'git_commit', description: 'Git commit' },
                ],
                tags: ['development', 'coding', 'git'],
            },
            {
                id: 'research',
                name: 'Research Tools',
                description: 'Tools for web research and information gathering',
                items: [
                    { toolName: 'web_search', description: 'Search the web', required: true },
                    { toolName: 'fetch_url', description: 'Fetch URL content', required: true },
                    { toolName: 'read_file', description: 'Read local files' },
                    { toolName: 'write_file', description: 'Save research notes' },
                ],
                tags: ['research', 'web', 'search'],
            },
            {
                id: 'database',
                name: 'Database Tools',
                description: 'Tools for database operations',
                items: [
                    { toolName: 'query_database', description: 'Execute SQL queries', required: true },
                    { toolName: 'list_tables', description: 'List database tables' },
                    { toolName: 'describe_table', description: 'Get table schema' },
                    { toolName: 'insert_record', description: 'Insert data' },
                    { toolName: 'update_record', description: 'Update data' },
                ],
                tags: ['database', 'sql', 'data'],
            },
            {
                id: 'devops',
                name: 'DevOps Tools',
                description: 'Tools for deployment and infrastructure',
                items: [
                    { toolName: 'docker_build', description: 'Build Docker images' },
                    { toolName: 'docker_run', description: 'Run Docker containers' },
                    { toolName: 'kubectl_apply', description: 'Apply Kubernetes manifests' },
                    { toolName: 'kubectl_get', description: 'Get Kubernetes resources' },
                    { toolName: 'ssh_execute', description: 'Execute commands via SSH' },
                ],
                tags: ['devops', 'docker', 'kubernetes', 'deployment'],
            },
            {
                id: 'analysis',
                name: 'Code Analysis Tools',
                description: 'Tools for code analysis and quality',
                items: [
                    { toolName: 'lint_code', description: 'Run linter' },
                    { toolName: 'run_tests', description: 'Run test suite' },
                    { toolName: 'check_types', description: 'Run type checker' },
                    { toolName: 'analyze_complexity', description: 'Analyze code complexity' },
                    { toolName: 'find_duplicates', description: 'Find duplicate code' },
                ],
                tags: ['analysis', 'quality', 'testing', 'lint'],
            },
            {
                id: 'documentation',
                name: 'Documentation Tools',
                description: 'Tools for documentation tasks',
                items: [
                    { toolName: 'read_file', description: 'Read documentation files', required: true },
                    { toolName: 'write_file', description: 'Write documentation', required: true },
                    { toolName: 'generate_docs', description: 'Auto-generate documentation' },
                    { toolName: 'convert_markdown', description: 'Convert markdown formats' },
                ],
                tags: ['documentation', 'docs', 'markdown'],
            },
            {
                id: 'minimal',
                name: 'Minimal Tools',
                description: 'Absolute minimum tools for basic operation',
                items: [
                    { toolName: 'read_file', description: 'Read file contents', required: true },
                    { toolName: 'write_file', description: 'Write file contents', required: true },
                ],
                tags: ['minimal', 'basic'],
            },
        ];

        for (const template of builtInTemplates) {
            this.templates.set(template.id, template);
        }
    }

    /**
     * Create a new tool set
     */
    createToolSet(params: {
        name: string;
        description: string;
        items: ToolSetItem[];
        tags?: string[];
        metadata?: Record<string, unknown>;
    }): ToolSet {
        const id = `toolset_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();

        const toolSet: ToolSet = {
            id,
            name: params.name,
            description: params.description,
            items: params.items,
            tags: params.tags || [],
            createdAt: now,
            updatedAt: now,
            metadata: params.metadata,
        };

        this.toolSets.set(id, toolSet);
        this.emit('toolset:created', { id, name: params.name });

        return toolSet;
    }

    /**
     * Create tool set from template
     */
    createFromTemplate(templateId: string, customizations?: {
        name?: string;
        additionalItems?: ToolSetItem[];
        excludeItems?: string[];
    }): ToolSet {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        let items = [...template.items];

        // Exclude specified items
        if (customizations?.excludeItems) {
            items = items.filter(i => !customizations.excludeItems!.includes(i.toolName));
        }

        // Add additional items
        if (customizations?.additionalItems) {
            items.push(...customizations.additionalItems);
        }

        return this.createToolSet({
            name: customizations?.name || template.name,
            description: template.description,
            items,
            tags: template.tags,
        });
    }

    /**
     * Get a tool set by ID
     */
    getToolSet(id: string): ToolSet | undefined {
        return this.toolSets.get(id);
    }

    /**
     * Get all tool sets
     */
    getAllToolSets(): ToolSet[] {
        return Array.from(this.toolSets.values());
    }

    /**
     * Get tool sets by tag
     */
    getToolSetsByTag(tag: string): ToolSet[] {
        return this.getAllToolSets().filter(ts => ts.tags.includes(tag));
    }

    /**
     * Update a tool set
     */
    updateToolSet(id: string, updates: Partial<Omit<ToolSet, 'id' | 'createdAt'>>): ToolSet {
        const existing = this.toolSets.get(id);
        if (!existing) {
            throw new Error(`Tool set ${id} not found`);
        }

        const updated: ToolSet = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        this.toolSets.set(id, updated);
        this.emit('toolset:updated', { id });

        return updated;
    }

    /**
     * Delete a tool set
     */
    deleteToolSet(id: string): boolean {
        const deleted = this.toolSets.delete(id);
        if (deleted) {
            this.emit('toolset:deleted', { id });
        }
        return deleted;
    }

    /**
     * Add item to tool set
     */
    addItemToToolSet(toolSetId: string, item: ToolSetItem): ToolSet {
        const toolSet = this.toolSets.get(toolSetId);
        if (!toolSet) {
            throw new Error(`Tool set ${toolSetId} not found`);
        }

        // Check for duplicates
        if (toolSet.items.some(i => i.toolName === item.toolName)) {
            throw new Error(`Tool ${item.toolName} already in tool set`);
        }

        return this.updateToolSet(toolSetId, {
            items: [...toolSet.items, item],
        });
    }

    /**
     * Remove item from tool set
     */
    removeItemFromToolSet(toolSetId: string, toolName: string): ToolSet {
        const toolSet = this.toolSets.get(toolSetId);
        if (!toolSet) {
            throw new Error(`Tool set ${toolSetId} not found`);
        }

        return this.updateToolSet(toolSetId, {
            items: toolSet.items.filter(i => i.toolName !== toolName),
        });
    }

    /**
     * Get all templates
     */
    getTemplates(): ToolSetTemplate[] {
        return Array.from(this.templates.values());
    }

    /**
     * Get template by ID
     */
    getTemplate(id: string): ToolSetTemplate | undefined {
        return this.templates.get(id);
    }

    /**
     * Register custom template
     */
    registerTemplate(template: ToolSetTemplate): void {
        this.templates.set(template.id, template);
        this.emit('template:registered', { id: template.id });
    }

    /**
     * Export tool set as JSON
     */
    exportToolSet(id: string): string {
        const toolSet = this.toolSets.get(id);
        if (!toolSet) {
            throw new Error(`Tool set ${id} not found`);
        }
        return JSON.stringify(toolSet, null, 2);
    }

    /**
     * Import tool set from JSON
     */
    importToolSet(json: string): ToolSet {
        const data = JSON.parse(json);
        
        // Generate new ID to avoid conflicts
        const id = `toolset_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();

        const toolSet: ToolSet = {
            id,
            name: data.name || 'Imported Tool Set',
            description: data.description || '',
            items: data.items || [],
            tags: data.tags || [],
            createdAt: now,
            updatedAt: now,
            metadata: data.metadata,
        };

        this.toolSets.set(id, toolSet);
        this.emit('toolset:imported', { id });

        return toolSet;
    }

    /**
     * Get tool names from a tool set
     */
    getToolNames(toolSetId: string): string[] {
        const toolSet = this.toolSets.get(toolSetId);
        if (!toolSet) {
            throw new Error(`Tool set ${toolSetId} not found`);
        }
        return toolSet.items.map(i => i.toolName);
    }

    /**
     * Get required tools from a tool set
     */
    getRequiredTools(toolSetId: string): string[] {
        const toolSet = this.toolSets.get(toolSetId);
        if (!toolSet) {
            throw new Error(`Tool set ${toolSetId} not found`);
        }
        return toolSet.items.filter(i => i.required).map(i => i.toolName);
    }

    /**
     * Check if all required tools are available
     */
    validateToolSet(toolSetId: string, availableTools: string[]): {
        valid: boolean;
        missingRequired: string[];
        missingOptional: string[];
    } {
        const toolSet = this.toolSets.get(toolSetId);
        if (!toolSet) {
            throw new Error(`Tool set ${toolSetId} not found`);
        }

        const availableSet = new Set(availableTools);
        const missingRequired: string[] = [];
        const missingOptional: string[] = [];

        for (const item of toolSet.items) {
            if (!availableSet.has(item.toolName)) {
                if (item.required) {
                    missingRequired.push(item.toolName);
                } else {
                    missingOptional.push(item.toolName);
                }
            }
        }

        return {
            valid: missingRequired.length === 0,
            missingRequired,
            missingOptional,
        };
    }

    /**
     * Merge multiple tool sets
     */
    mergeToolSets(toolSetIds: string[], name: string, description: string): ToolSet {
        const allItems: ToolSetItem[] = [];
        const allTags: Set<string> = new Set();
        const seenTools: Set<string> = new Set();

        for (const id of toolSetIds) {
            const toolSet = this.toolSets.get(id);
            if (!toolSet) {
                throw new Error(`Tool set ${id} not found`);
            }

            for (const item of toolSet.items) {
                if (!seenTools.has(item.toolName)) {
                    allItems.push(item);
                    seenTools.add(item.toolName);
                }
            }

            for (const tag of toolSet.tags) {
                allTags.add(tag);
            }
        }

        return this.createToolSet({
            name,
            description,
            items: allItems,
            tags: Array.from(allTags),
        });
    }
}

// Singleton instance
let managerInstance: ToolSetManager | null = null;

export function getToolSetManager(): ToolSetManager {
    if (!managerInstance) {
        managerInstance = new ToolSetManager();
    }
    return managerInstance;
}
