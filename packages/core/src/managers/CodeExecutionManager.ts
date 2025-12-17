import ivm from 'isolated-vm';

export class CodeExecutionManager {
    private isolate: ivm.Isolate;
    private context: ivm.Context;

    constructor() {
        // Initialize the isolate
        this.isolate = new ivm.Isolate({ memoryLimit: 128 });
        this.context = this.isolate.createContextSync();

        // Setup global context with basic utilities
        const jail = this.context.global;
        jail.setSync('global', jail.derefInto());

        // We will inject a 'console.log' equivalent
        this.context.evalSync(`
            global.console = {
                log: function(...args) {
                    // This will be replaced/bridged
                }
            };
        `);
    }

    async execute(code: string, toolCallback: (name: string, args: any) => Promise<any>): Promise<string> {
        const jail = this.context.global;

        // Bridge the tool call function
        jail.setSync('call_tool', new ivm.Reference(async (name: string, args: any) => {
            console.log(`[Sandbox] Calling tool: ${name}`);
            // Note: args from IVM might need unwrapping
            // For simplicity in this skeleton, we assume basic JSON
            return await toolCallback(name, args);
        }));

        // Wrap user code in an async function to allow await
        const wrappedCode = `
            (async () => {
                ${code}
            })();
        `;

        try {
            const script = await this.isolate.compileScript(wrappedCode);
            const result = await script.run(this.context, { timeout: 5000 });
            return JSON.stringify(result);
        } catch (err: any) {
            return `Error: ${err.message}`;
        }
    }
}
