import { AgentDefinition } from '../types.js';
import { AgentAdapter } from './AgentAdapter.js';

export class OpenCodeAdapter implements AgentAdapter {
    async parse(filepath: string, content: string): Promise<AgentDefinition | null> {
        // Parse Frontmatter
        // Handle possible CRLF issues or whitespace before dashes
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
        const match = content.trim().match(frontmatterRegex);
        
        if (!match) return null;
        
        const frontmatterRaw = match[1];
        let metadata: any = {};
        
        const lines = frontmatterRaw.split('\n');
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim().replace(/^"|"$/g, '');
                if (key && value) {
                    metadata[key] = value;
                }
            }
        }

        // Parse XML Sections for Instructions
        const instructions = this.extractXmlSections(content);
        
        // Map to AgentDefinition
        return {
            name: metadata.name || metadata.id || 'Unknown Agent',
            description: metadata.description || '',
            instructions: instructions,
            tools: metadata.tools ? metadata.tools.split(',').map((t: string) => t.trim()) : [],
            model: metadata.model || undefined
        };
    }

    private extractXmlSections(content: string): string {
        const sections = ['context', 'critical_rules', 'workflow', 'example'];
        let instructions = '';

        // Remove frontmatter
        const contentBody = content.replace(/^---\s*\n([\s\S]*?)\n---/, '').trim();

        // Extract specific sections if they exist, otherwise use the whole body
        let foundSection = false;
        
        for (const section of sections) {
            const regex = new RegExp(`<${section}>([\\s\\S]*?)<\/${section}>`, 'g');
            let match;
            while ((match = regex.exec(contentBody)) !== null) {
                foundSection = true;
                instructions += `\n\n## ${section.toUpperCase().replace('_', ' ')}\n${match[1].trim()}`;
            }
        }

        if (!foundSection) {
            instructions = contentBody;
        }

        return instructions.trim();
    }
}
