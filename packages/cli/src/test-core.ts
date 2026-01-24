console.log("DEBUG: Starting import test...");
const start = Date.now();
try {
    console.log("DEBUG: Importing @borg/core...");
    const core = await import('@borg/core');
    console.log("DEBUG: @borg/core loaded successfully in " + (Date.now() - start) + "ms");
    console.log("Exports:", Object.keys(core));
} catch (e) {
    console.error("DEBUG: Failed to import @borg/core", e);
}
