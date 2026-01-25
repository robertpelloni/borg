export declare const SearchTools: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            path: {
                type: string;
                description: string;
            };
            filePattern: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        query: string;
        path?: string;
        filePattern?: string;
    }) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
}[];
//# sourceMappingURL=SearchTools.d.ts.map