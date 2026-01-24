console.log("DEBUG: Starting Granular Import Test");

async function testImport(name: string, path: string) {
    console.log(`Trying import: ${name}...`);
    const start = Date.now();
    try {
        await import(path);
        console.log(`  -> SUCCESS (${Date.now() - start}ms)`);
    } catch (e) {
        console.error(`  -> FAILED: ${e}`);
    }
}

(async () => {
    // Check dependencies of core/index.ts
    await testImport('api/router', '../../core/src/api/router.ts');
    await testImport('MCPServer', '../../core/src/MCPServer.ts');

    // Check dependencies of MCPServer
    await testImport('VectorStore', '../../core/src/memory/VectorStore.ts');
    await testImport('Indexer', '../../core/src/memory/Indexer.ts');
    await testImport('SkillRegistry', '../../core/src/skills/SkillRegistry.ts');
    await testImport('Director', '../../core/src/agents/Director.ts');
    await testImport('Council', '../../core/src/agents/Council.ts');
})();
