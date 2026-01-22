import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

export interface LLMResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

export class LLMService {
    private googleClient?: GoogleGenerativeAI;
    private openaiClient?: OpenAI;
    private anthropicClient?: Anthropic;

    constructor() {
        if (process.env.GOOGLE_API_KEY) {
            this.googleClient = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        }
        if (process.env.OPENAI_API_KEY) {
            this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
    }

    async generateText(provider: string, modelId: string, systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
        console.log(`[LLMService] Generating with ${provider}/${modelId}...`);

        try {
            if (provider === 'google') {
                if (!this.googleClient) throw new Error("Google API Key not configured.");
                const model = this.googleClient.getGenerativeModel({ model: modelId });
                // Gemini doesn't always support 'system' role in the same way, but 1.5 Pro does via systemInstruction
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    systemInstruction: systemPrompt
                });
                return { content: result.response.text() };
            }

            if (provider === 'anthropic') {
                if (!this.anthropicClient) throw new Error("Anthropic API Key not configured.");
                const msg = await this.anthropicClient.messages.create({
                    model: modelId,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userPrompt }]
                });
                return {
                    content: (msg.content[0] as any).text,
                    usage: {
                        inputTokens: msg.usage.input_tokens,
                        outputTokens: msg.usage.output_tokens
                    }
                };
            }

            if (provider === 'openai') {
                if (!this.openaiClient) throw new Error("OpenAI API Key not configured.");
                const completion = await this.openaiClient.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    model: modelId,
                });
                return {
                    content: completion.choices[0].message.content || "",
                    usage: {
                        inputTokens: completion.usage?.prompt_tokens || 0,
                        outputTokens: completion.usage?.completion_tokens || 0
                    }
                };
            }

            throw new Error(`Unsupported provider: ${provider}`);
        } catch (error: any) {
            console.error(`[LLMService] Error from ${provider}:`, error.message);
            throw error;
        }
    }
}
