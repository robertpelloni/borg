export declare const TerminalTools: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            command: {
                type: string;
                description: string;
            };
            cwd: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        command: string;
        cwd?: string;
    }) => Promise<unknown>;
}[];
//# sourceMappingURL=TerminalTools.d.ts.map