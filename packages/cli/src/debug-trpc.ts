console.log("DEBUG: Testing tRPC and SearchTools");

async function test(name: string, p: string) {
    console.log(`[TEST] Importing ${name}...`);
    const start = Date.now();
    try {
        await import(p);
        console.log(`[TEST] ✅ ${name} (${Date.now() - start}ms)`);
    } catch (e) {
        console.error(`[TEST] ❌ ${name} ERROR:`, e);
    }
}

(async () => {
    // Check trpc.ts (internal)
    await test('core/trpc', '../../core/src/trpc.ts');

    // Check SearchTools (internal) - might have heavy deps?
    await test('core/tools/SearchTools', '../../core/src/tools/SearchTools.ts');

    // Check external tRPC adapter again
    await test('trpc-express', '@trpc/server/adapters/express');
})();
