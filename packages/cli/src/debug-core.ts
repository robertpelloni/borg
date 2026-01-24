console.log("DEBUG: STARTING INCREMENTAL LOAD");

try {
    console.log("0. Importing LLMService...");
    await import('../../core/src/ai/LLMService.ts');
    console.log("   -> OK");

    console.log("1. Importing Router...");
    await import('../../core/src/Router.ts');
    console.log("   -> OK");

    console.log("2. Importing ModelSelector...");
    await import('../../core/src/ModelSelector.ts');
    console.log("   -> OK");

    console.log("3. Importing SkillRegistry...");
    await import('../../core/src/skills/SkillRegistry.ts');
    console.log("   -> OK");

    console.log("3b. Importing Council...");
    await import('../../core/src/agents/Council.ts');
    console.log("   -> OK");

    console.log("4. Importing Director...");
    await import('../../core/src/agents/Director.ts');
    console.log("   -> OK");

    console.log("5. Importing MCPServer...");
    await import('../../core/src/MCPServer.ts');
    console.log("   -> OK");

} catch (e) {
    console.error("ERROR:", e);
}
