export declare const ConfigTools: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            content?: undefined;
        };
        required?: undefined;
    };
    handler: () => Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            content: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        content: string;
    }) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
})[];
//# sourceMappingURL=ConfigTools.d.ts.map