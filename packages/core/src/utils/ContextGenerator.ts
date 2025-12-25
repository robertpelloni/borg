import fs from 'fs';
import path from 'path';

export class ContextGenerator {
    private rootDir: string;
    private contextDir: string;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.contextDir = path.join(rootDir, 'context');
    }

    generate() {
        const universal = fs.readFileSync(path.join(this.contextDir, 'universal.md'), 'utf-8');

        // CLAUDE.md
        const claudeContent = `${universal}\n\n## Claude Specifics\n- You are running in Claude Code or Desktop.\n- Use Markdown for rich output.`;
        fs.writeFileSync(path.join(this.rootDir, 'CLAUDE.md'), claudeContent);

        // GEMINI.md
        const geminiContent = `${universal}\n\n## Gemini Specifics\n- You are running in Gemini CLI.\n- Keep responses concise.`;
        fs.writeFileSync(path.join(this.rootDir, 'GEMINI.md'), geminiContent);

        // AGENTS.md (Base template)
        const agentsContent = `${universal}\n\n## Agents Registry\nThis file defines the available autonomous agents.\n\n### Example Agent\n\`\`\`json\n{\n  "name": "example",\n  "instructions": "Follow universal instructions."\n}\n\`\`\``;
        // Don't overwrite AGENTS.md if it has custom content, but for now we create a base if missing
        if (!fs.existsSync(path.join(this.rootDir, 'AGENTS.md'))) {
            fs.writeFileSync(path.join(this.rootDir, 'AGENTS.md'), agentsContent);
        }

        console.log('[ContextGenerator] Generated platform-specific context files.');
    }
}
