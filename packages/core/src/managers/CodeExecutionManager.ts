import vm from 'vm';

export class CodeExecutionManager {
    // Default timeout for code execution (in milliseconds)
    private readonly executionTimeout: number = 5000; // 5 seconds

    constructor() {
    }

    async execute(code: string, toolCallback: (name: string, args: any) => Promise<any>): Promise<string> {
        // Create a sandboxed context with resource limits
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
            // Execute with timeout to prevent resource exhaustion
            // Note: vm.runInContext doesn't support timeout directly for async code,
            // so we implement a Promise.race with a timeout
            const resultPromise = vm.runInContext(wrappedCode, context, {
                timeout: this.executionTimeout,
                displayErrors: true
            });

            let result;
            if (resultPromise && typeof resultPromise.then === 'function') {
                // Race the execution against a timeout
                result = await Promise.race([
                    resultPromise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Code execution timeout exceeded')), this.executionTimeout)
                    )
                ]);
            } else {
                result = resultPromise;
            }

            return JSON.stringify(result);
        } catch (err: any) {
            return `Error: ${err.message}`;
        }
    }
}
