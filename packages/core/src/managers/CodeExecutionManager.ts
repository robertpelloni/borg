import vm from 'vm';

export class CodeExecutionManager {
    constructor() {
    }

    async execute(code: string, toolCallback: (name: string, args: any) => Promise<any>): Promise<string> {
        // Create a sandboxed context
        const context = {
            console: {
                log: (...args: any[]) => console.log('[Sandbox]', ...args)
            },
            call_tool: async (name: string, args: any) => {
                 console.log(`[Sandbox] Calling tool: ${name}`);
                 return await toolCallback(name, args);
            }
        };

        vm.createContext(context);

        // Wrap code in async IIFE
        const wrappedCode = `
            (async () => {
                ${code}
            })();
        `;

        try {
            // vm.runInContext returns the result of the last expression
            // which is the promise from the IIFE
            // Added timeout for security
            const resultPromise = vm.runInContext(wrappedCode, context, { timeout: 5000 });

            let result;
            if (resultPromise && typeof resultPromise.then === 'function') {
                result = await resultPromise;
            } else {
                result = resultPromise;
            }

            return JSON.stringify(result);
        } catch (err: any) {
            return `Error: ${err.message}`;
        }
    }
}
