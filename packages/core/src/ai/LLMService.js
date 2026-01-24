import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();
export class LLMService {
    googleClient;
    openaiClient;
    anthropicClient;
    totalUsage = { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 };
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
    getCostStats() {
        return this.totalUsage;
    }
    trackUsage(provider, model, usage) {
        if (!usage)
            return;
        this.totalUsage.inputTokens += usage.inputTokens;
        this.totalUsage.outputTokens += usage.outputTokens;
        // Simple cost estimation (averaged high-tier rates: $5/1M in, $15/1M out)
        // Adjust per model if needed in future
        const inputRate = 5.0 / 1_000_000;
        const outputRate = 15.0 / 1_000_000;
        const cost = (usage.inputTokens * inputRate) + (usage.outputTokens * outputRate);
        this.totalUsage.estimatedCostUSD += cost;
        console.log(`[LLMService] Cost: $${cost.toFixed(6)} | Total: $${this.totalUsage.estimatedCostUSD.toFixed(4)}`);
    }
    async generateText(provider, modelId, systemPrompt, userPrompt) {
        console.log(`[LLMService] Generating with ${provider}/${modelId}...`);
        let response;
        try {
            if (provider === 'google') {
                if (!this.googleClient)
                    throw new Error("Google API Key not configured.");
                const model = this.googleClient.getGenerativeModel({ model: modelId });
                // Gemini doesn't always support 'system' role in the same way, but 1.5 Pro does via systemInstruction
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    systemInstruction: systemPrompt
                });
                const text = result.response.text();
                // Estimate tokens for Gemini (chars / 4)
                response = {
                    content: text,
                    usage: {
                        inputTokens: (systemPrompt.length + userPrompt.length) / 4,
                        outputTokens: text.length / 4
                    }
                };
            }
            else if (provider === 'anthropic') {
                if (!this.anthropicClient)
                    throw new Error("Anthropic API Key not configured.");
                const msg = await this.anthropicClient.messages.create({
                    model: modelId,
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userPrompt }]
                });
                response = {
                    content: msg.content[0].text,
                    usage: {
                        inputTokens: msg.usage.input_tokens,
                        outputTokens: msg.usage.output_tokens
                    }
                };
            }
            else if (provider === 'openai') {
                if (!this.openaiClient)
                    throw new Error("OpenAI API Key not configured.");
                const completion = await this.openaiClient.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    model: modelId,
                });
                response = {
                    content: completion.choices[0].message.content || "",
                    usage: {
                        inputTokens: completion.usage?.prompt_tokens || 0,
                        outputTokens: completion.usage?.completion_tokens || 0
                    }
                };
            }
            else if (provider === 'deepseek') {
                // DeepSeek is OpenAI compatible but needs a custom Base URL and Key.
                // We create a fleeting client or use a cached one if we want optimization.
                // For now, simpler to create one on the fly to avoid constructor pollution, 
                // or add a deepseekClient property. Let's add a cached property logic later if needed.
                const dsClient = new OpenAI({
                    apiKey: process.env.DEEPSEEK_API_KEY,
                    baseURL: 'https://api.deepseek.com'
                });
                const completion = await dsClient.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    model: modelId,
                });
                response = {
                    content: completion.choices[0].message.content || "",
                    usage: {
                        inputTokens: completion.usage?.prompt_tokens || 0,
                        outputTokens: completion.usage?.completion_tokens || 0
                    }
                };
            }
            else if (provider === 'ollama') {
                // Ollama Local Inference
                const res = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelId || 'gemma',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        stream: false
                    })
                });
                if (!res.ok) {
                    throw new Error(`Ollama Error: ${res.statusText}`);
                }
                const data = await res.json();
                response = {
                    content: data.message?.content || "",
                    usage: {
                        inputTokens: data.prompt_eval_count || 0,
                        outputTokens: data.eval_count || 0
                    }
                };
            }
            else if (provider === 'lmstudio') {
                // LM Studio (OpenAI Compatible)
                // Assumes running on localhost:1234
                const lmClient = new OpenAI({
                    apiKey: 'lm-studio', // Not used usually, but required by SDK
                    baseURL: 'http://localhost:1234/v1'
                });
                const completion = await lmClient.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    model: modelId || 'local-model', // LM Studio often ignores model name or uses the loaded one
                });
                response = {
                    content: completion.choices[0].message.content || "",
                    usage: {
                        inputTokens: completion.usage?.prompt_tokens || 0,
                        outputTokens: completion.usage?.completion_tokens || 0
                    }
                };
            }
            else {
                throw new Error(`Unsupported provider: ${provider}`);
            }
            // Track Usage
            this.trackUsage(provider, modelId, response.usage);
            return response;
        }
        catch (error) {
            const isConnectionError = error.cause?.code === 'ECONNREFUSED' || error.message.includes('fetch failed');
            if (isConnectionError) {
                console.warn(`[LLMService] Connection failed for ${provider} (Is it running?).`);
            }
            else {
                console.error(`[LLMService] Error from ${provider}:`, error.message);
            }
            throw error;
        }
    }
}
