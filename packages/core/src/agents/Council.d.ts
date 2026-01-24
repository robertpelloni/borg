import { ModelSelector } from "../ModelSelector.js";
interface DebateResult {
    approved: boolean;
    transcripts: {
        speaker: string;
        text: string;
    }[];
    summary: string;
}
export declare class Council {
    private modelSelector;
    private members;
    private llmService;
    constructor(modelSelector: ModelSelector);
    startDebate(proposal: string): Promise<DebateResult>;
    private consultMember;
}
export {};
//# sourceMappingURL=Council.d.ts.map