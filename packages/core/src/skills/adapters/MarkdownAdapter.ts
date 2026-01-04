
import { SkillAdapter } from './BaseAdapter.js';
import { z } from 'zod';

export class MarkdownSkillAdapter implements SkillAdapter {
    name = "MarkdownSkill";
    version = "1.0.0";

    // Detect if content is a markdown skill
    isCompatible(content: string): boolean {
        return content.trim().startsWith('---') && content.includes('name:') && content.includes('description:');
    }

    async convert(content: string): Promise<any> {
        // Simple Frontmatter parser (naive)
        const frontmatterRegex = /^---\s*([\s\S]*?)\s*---/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            throw new Error("Invalid Markdown Skill: No frontmatter found");
        }

        const frontmatter = match[1];
        const metadata: any = {};
        
        frontmatter.split('\n').forEach(line => {
            const [key, ...values] = line.split(':');
            if (key && values.length) {
                metadata[key.trim()] = values.join(':').trim();
            }
        });

        // The body is the "instruction"
        const instruction = content.replace(frontmatterRegex, '').trim();

        return {
            name: metadata.name || 'unnamed_skill',
            description: metadata.description || 'No description provided',
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Context or query to apply this skill to." }
                }
            },
            // This is the "prompt" template
            instruction: instruction
        };
    }
}
