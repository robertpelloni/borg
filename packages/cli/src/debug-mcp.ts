console.log("DEBUG: Testing MCPServer Components");

try {
    console.log("1. Importing WebSocket Transport...");
    await import('../../core/src/transports/WebSocketServerTransport.ts');
    console.log("   -> OK");

    console.log("2. Importing VectorStore...");
    await import('../../core/src/memory/VectorStore.ts');
    console.log("   -> OK");

    console.log("3. Importing Indexer...");
    await import('../../core/src/memory/Indexer.ts');
    console.log("   -> OK");

    console.log("3b. Importing jsdom...");
    await import('jsdom');
    console.log("   -> OK");

    console.log("3c. Importing turndown...");
    await import('turndown');
    console.log("   -> OK");

    console.log("4. Importing ReaderTools...");
    await import('../../core/src/tools/ReaderTools.ts');
    console.log("   -> OK");

    console.log("5. Importing TunnelTools...");
    await import('../../core/src/tools/TunnelTools.ts');
    console.log("   -> OK");

} catch (e) {
    console.error("ERROR:", e);
}
