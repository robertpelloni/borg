import { ModelSelector } from "../ModelSelector.js";
import { LLMService } from "../ai/LLMService.js";

interface CouncilMember {
    name: string;
    role: string;
    personality: string;
}

interface DebateResult {
    approved: boolean;
    transcripts: { speaker: string, text: string }[];
    summary: string;
}

export class Council {
    private members: CouncilMember[] = [
        { name: "The Architect", role: "System Design", personality: "Focuses on scalability, clean code, and patterns. Strict." },
        { name: "The Guardian", role: "Security", personality: "Paranoid about system modifications (writes, execution, network). Permissive for reading project files (md, ts, json) to enable learning." },
        { name: "The Optimizer", role: "Performance", personality: "Obsessed with speed and resource usage. Pragmatic." }
    ];

    private llmService: LLMService;

    constructor(private modelSelector: ModelSelector) {
        this.llmService = new LLMService();
    }

    async startDebate(proposal: string): Promise<DebateResult> {
        console.log(`[Council] 🏛️ Session started for: "${proposal}"`);
        const transcripts: { speaker: string, text: string }[] = [];

        // Parallel Consultation
        const consultations = this.members.map(member => this.consultMember(member, proposal));
        const results = await Promise.all(consultations);

        for (const res of results) {
            transcripts.push({
                speaker: res.member.name,
                text: res.response
            });
        }

        // Decision Logic: Create a summary of the advice.
        // We no longer calculate votes or enforce vetos. The Council is ADVISORY.
        const summary = `Council Advice: ${results.map(r => `${r.member.name}: ${r.shortAdvice}`).join(' | ')}`;

        console.log(`[Council] 🏁 Consensus: ${summary}`);
        return {
            approved: true, // ALWAYS approved now. Council is advisory.
            transcripts,
            summary
        };
    }

    private async consultMember(member: CouncilMember, proposal: string): Promise<{ member: CouncilMember, response: string, shortAdvice: string }> {
        // Select a smart model for the Council
        const model = await this.modelSelector.selectModel({ taskComplexity: 'medium', taskType: 'supervisor' });

        const systemPrompt = `You are ${member.name}, a member of the AI Council.
Role: ${member.role}
Personality: ${member.personality}

Your task is to review the following technical proposal/action given by an autonomous agent.
You must provide constructive criticism, strategic advice, or alternative suggestions.
You are NOT a gatekeeper. You are a collaborator.

RESPONSE FORMAT:
Start your response with a concise 1-sentence summary of your advice (max 15 words).
Then provide a detailed explanation or suggestion in the following paragraph.
`;

        const userPrompt = `PROPOSAL: "${proposal}"\n\nWhat is your advice?`;

        try {
            const response = await this.llmService.generateText(model.provider, model.modelId, systemPrompt, userPrompt);
            const content = response.content.trim();

            console.log(`[Council] 👤 ${member.name}: ${content}`);

            // Extract first sentence as short advice
            const firstLine = content.split('\n')[0] || "No advice.";

            return {
                member,
                response: content,
                shortAdvice: firstLine
            };

        } catch (e: any) {
            console.error(`[Council] Error consulting ${member.name}:`, e.message);
            return {
                member,
                response: `[Error: ${e.message}] Abstained.`,
                shortAdvice: "Abstained."
            };
        }
    }
}
