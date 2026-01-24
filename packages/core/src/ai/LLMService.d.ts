export interface LLMResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}
export declare class LLMService {
    private googleClient?;
    private openaiClient?;
    private anthropicClient?;
    private totalUsage;
    constructor();
    getCostStats(): {
        inputTokens: number;
        outputTokens: number;
        estimatedCostUSD: number;
    };
    private trackUsage;
    generateText(provider: string, modelId: string, systemPrompt: string, userPrompt: string): Promise<LLMResponse>;
}
//# sourceMappingURL=LLMService.d.ts.map