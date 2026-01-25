export declare const MemoryTools: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            key: {
                type: string;
                description: string;
            };
            value: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        key: string;
        value: string;
        tags?: string[];
    }) => Promise<{
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
            key: {
                type: string;
                description: string;
            };
            value?: undefined;
            tags?: undefined;
        };
        required: string[];
    };
    handler: (args: {
        key: string;
    }) => Promise<{
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
            key?: undefined;
            value?: undefined;
            tags?: undefined;
        };
        required?: undefined;
    };
    handler: () => Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
})[];
//# sourceMappingURL=MemoryTools.d.ts.map