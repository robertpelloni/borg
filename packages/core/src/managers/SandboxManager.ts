import ivm from 'isolated-vm';

export class SandboxManager {
    private isolate: ivm.Isolate;
    private context: ivm.Context;
    private jail: ivm.Reference<any>;

    constructor() {
        // Create a new isolate with 128MB memory limit
        this.isolate = new ivm.Isolate({ memoryLimit: 128 });
        this.context = this.isolate.createContextSync();
        this.jail = this.context.global;
        
        // Initialize the environment
        this.jail.setSync('global', this.jail.derefInto());
        this.jail.setSync('console', this.createConsole());
    }

    private createConsole() {
        return new ivm.Reference((message: any) => {
            console.log('[Sandbox]', message);
        });
    }

    /**
     * Execute code in the sandbox.
     * @param code The JavaScript code to execute.
     * @param toolCallback A function to call tools from within the sandbox.
     */
    async execute(code: string, toolCallback: (name: string, args: any) => Promise<any>): Promise<any> {
        // Inject the tool callback
        const callbackRef = new ivm.Reference(async (name: string, args: any) => {
            try {
                return await toolCallback(name, args);
            } catch (e: any) {
                throw new Error(`Tool execution failed: ${e.message}`);
            }
        });
        
        await this.context.global.set('_host_tool_callback', callbackRef);
        
        // Define the bridge function - callTool (camelCase)
        await this.context.eval(`
            global.callTool = function(name, args) {
                return _host_tool_callback.apply(undefined, [name, args], { 
                    arguments: { copy: true }, 
                    result: { promise: true, copy: true } 
                });
            };
        `);

        // Wrap code in an async function to allow await
        // Users must explicitly return a value if they want output
        const wrappedCode = `
            (async () => {
                try {
                    ${code}
                } catch (e) {
                    throw e;
                }
            })()
        `;

        try {
            const script = await this.isolate.compileScript(wrappedCode);
            // We use 'promise: true' to wait for the async IIFE to resolve
            // We use 'copy: true' to get the actual value back instead of a Reference
            const result = await script.run(this.context, { 
                timeout: 5000, 
                promise: true,
                copy: true 
            }); 
            
            return result;
        } catch (e: any) {
            // Handle timeout specifically
            if (e.message && e.message.includes('timed out')) {
                 throw new Error('Script execution timed out');
            }
            throw new Error(`Sandbox execution failed: ${e.message}`);
        }
    }

    dispose() {
        this.context.release();
        this.isolate.dispose();
    }
}
