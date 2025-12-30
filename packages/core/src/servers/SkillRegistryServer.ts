
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SkillManager } from '../managers/SkillManager.js';

export class SkillRegistryServer {
    private server: McpServer;
    private skillManager: SkillManager;

    constructor(skillManager: SkillManager) {
        this.skillManager = skillManager;
        this.server = new McpServer({
            name: "SkillRegistry",
            version: "1.0.0"
        }, {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {}
            }
        });

        this.setupTools();
    }

    private setupTools() {
        // Tool: List Skills
        this.server.tool(
            "list_skills",
            "List all available skills in the registry",
            {}, // No params
            async () => {
                const skills = this.skillManager.listSkills();
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify(skills, null, 2) 
                    }]
                };
            }
        );

        // Tool: Execute Skill
        this.server.tool(
            "execute_skill",
            "Execute a specific skill by ID",
            {
                skill_id: z.string().describe("The ID of the skill to execute"),
                params: z.record(z.any()).optional().describe("Parameters for the skill")
            },
            async ({ skill_id, params }) => {
                try {
                    const result = await this.skillManager.executeSkill(skill_id, params || {});
                    
                    // Format result based on type
                    let outputText = "";
                    if (typeof result === 'string') {
                        outputText = result;
                    } else {
                        outputText = JSON.stringify(result, null, 2);
                    }

                    return {
                        content: [{ type: "text", text: outputText }]
                    };
                } catch (e: any) {
                    return {
                        content: [{ type: "text", text: `Error executing skill ${skill_id}: ${e.message}` }],
                        isError: true
                    };
                }
            }
        );
        
        // Tool: Get Skill Info
        this.server.tool(
            "get_skill_info",
            "Get detailed information about a skill",
            {
                skill_id: z.string().describe("The ID of the skill")
            },
            async ({ skill_id }) => {
                const def = this.skillManager.getSkillDefinition(skill_id);
                if (!def) {
                    return {
                        content: [{ type: "text", text: `Skill ${skill_id} not found` }],
                        isError: true
                    };
                }
                
                // We could also load the skill to see its type
                let typeInfo = "Unknown";
                try {
                    const loaded = await this.skillManager.loadSkill(skill_id);
                    typeInfo = loaded?.type || "Unknown";
                } catch (e) {}

                return {
                    content: [{ type: "text", text: JSON.stringify({ ...def, type: typeInfo }, null, 2) }]
                };
            }
        );
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Skill Registry MCP Server running on stdio");
    }
}
