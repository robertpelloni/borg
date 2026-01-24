console.log("DEBUG: Testing Imports...");

const imports = [
    { name: 'express', path: 'express' },
    { name: 'cors', path: 'cors' },
    { name: 'trpc-express', path: '@trpc/server/adapters/express' },
    { name: 'api/router', path: '../../core/src/api/router.ts' }
];

(async () => {
    for (const { name, path } of imports) {
        console.log(`[TEST] Importing ${name}...`);
        const start = Date.now();
        try {
            await import(path);
            console.log(`[TEST] ✅ ${name} (${Date.now() - start}ms)`);
        } catch (e) {
            console.error(`[TEST] ❌ ${name} ERROR:`, e);
        }
    }
    console.log("[TEST] DONE");
})();
