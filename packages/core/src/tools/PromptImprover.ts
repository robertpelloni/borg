import { ModelGateway } from '../gateway/ModelGateway.js';

export const createPromptImprover = (gateway: ModelGateway) => {
    return {
        name: "improve_prompt",
        description: "Optimize a given prompt using advanced prompt engineering techniques to get better results from LLMs.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: { type: "string" },
                goal: { type: "string", description: "What you want to achieve with this prompt (optional)" }
            },
            required: ["prompt"]
        },
        handler: async (args: any) => {
            const { prompt, goal } = args;

            const system = `You are an expert Prompt Engineer. Your goal is to rewrite the user's prompt to be more effective, precise, and robust.
            Use techniques like Chain of Thought, delimiting instructions, and few-shot examples where appropriate.
            Return ONLY the improved prompt text.`;

            const userContent = `Original Prompt:\n${prompt}\n\n${goal ? `Goal: ${goal}` : ''}`;

            const response = await gateway.chat([
                { role: 'system', content: system },
                { role: 'user', content: userContent }
            ]);

            return response;
        }
    };
};
