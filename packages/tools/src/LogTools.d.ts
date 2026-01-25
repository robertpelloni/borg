export declare const LogTools: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            lines: {
                type: string;
                description: string;
            };
        };
    };
    handler: (args: {
        lines?: number;
    }) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
}[];
//# sourceMappingURL=LogTools.d.ts.map