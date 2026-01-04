
import { SkillManager } from '../src/managers/SkillManager.ts';
import { SkillRegistryServer } from '../src/servers/SkillRegistryServer.ts';

// Entry point script
async function main() {
    const manager = new SkillManager();
    await manager.initialize();
    
    const server = new SkillRegistryServer(manager);
    await server.start();
}

main().catch(console.error);
