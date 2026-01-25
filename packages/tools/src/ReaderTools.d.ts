export declare const ReaderTools: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            url: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: any) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
}[];
//# sourceMappingURL=ReaderTools.d.ts.map