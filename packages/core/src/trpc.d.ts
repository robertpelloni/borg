export declare const t: import("@trpc/server").TRPCRootObject<object, object, import("@trpc/server").TRPCRuntimeConfigOptions<object, object>, {
    ctx: object;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}>;
export declare const appRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: object;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    health: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            status: string;
            service: string;
        };
        meta: object;
    }>;
    getTaskStatus: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            taskId?: string | undefined;
        };
        output: {
            taskId: string;
            status: string;
            progress: number;
        };
        meta: object;
    }>;
    indexingStatus: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            status: string;
            filesIndexed: number;
            totalFiles: number;
        };
        meta: object;
    }>;
    remoteAccess: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        start: import("@trpc/server").TRPCMutationProcedure<{
            input: void;
            output: string;
            meta: object;
        }>;
        stop: import("@trpc/server").TRPCMutationProcedure<{
            input: void;
            output: string;
            meta: object;
        }>;
        status: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any;
            meta: object;
        }>;
    }>>;
    config: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        readAntigravity: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any;
            meta: object;
        }>;
        writeAntigravity: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                content: string;
            };
            output: string;
            meta: object;
        }>;
    }>>;
    logs: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        read: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                lines?: number | undefined;
            };
            output: string;
            meta: object;
        }>;
    }>>;
    autonomy: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        setLevel: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                level: "low" | "medium" | "high";
            };
            output: "low" | "medium" | "high";
            meta: object;
        }>;
        getLevel: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any;
            meta: object;
        }>;
        activateFullAutonomy: import("@trpc/server").TRPCMutationProcedure<{
            input: void;
            output: string;
            meta: object;
        }>;
    }>>;
    director: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        chat: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                message: string;
            };
            output: any;
            meta: object;
        }>;
        status: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any;
            meta: object;
        }>;
        stopAutoDrive: import("@trpc/server").TRPCMutationProcedure<{
            input: void;
            output: string;
            meta: object;
        }>;
        startAutoDrive: import("@trpc/server").TRPCMutationProcedure<{
            input: void;
            output: string;
            meta: object;
        }>;
    }>>;
    council: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        startDebate: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                proposal: string;
            };
            output: any;
            meta: object;
        }>;
    }>>;
    runCommand: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            command: string;
        };
        output: any;
        meta: object;
    }>;
    skills: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        list: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any;
            meta: object;
        }>;
        read: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                name: string;
            };
            output: any;
            meta: object;
        }>;
    }>>;
    executeTool: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            name: string;
            args?: any;
        };
        output: any;
        meta: object;
    }>;
    git: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getSubmodules: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any[];
            meta: object;
        }>;
    }>>;
    billing: import("@trpc/server").TRPCBuiltRouter<{
        ctx: object;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getStatus: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                keys: {
                    openai: boolean;
                    anthropic: boolean;
                    gemini: boolean;
                    mistral: boolean;
                };
                usage: {
                    currentMonth: number;
                    limit: number;
                    breakdown: {
                        provider: string;
                        cost: number;
                        requests: number;
                    }[];
                };
            };
            meta: object;
        }>;
    }>>;
}>>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=trpc.d.ts.map