
import { AgentManager } from './packages/core/src/managers/AgentManager.ts';
import path from 'path';

async function verifySkillUserAgent() {
    console.log('--- Verifying Skill User Agent Integration ---');

    const rootDir = path.resolve('packages/core/src');
    const agentManager = new AgentManager(rootDir);
    await agentManager.start();
    
    // Give it a moment to scan (since it's async)
    await new Promise(r => setTimeout(r, 1000));

    // Manually trigger file change event to force load
    // Since watcher might not pick up existing files immediately on "start" depending on implementation
    // The implementation of start() does chokidar.watch(...).
    // Chokidar should fire 'add' for existing files.
    
    const agents = agentManager.getAgents();
    const skillAgent = agents.find(a => a.name === 'skill-user-agent');
    
    if (skillAgent) {
        console.log('✅ skill-user-agent loaded successfully!');
        console.log('Tools:', skillAgent.tools);
    } else {
        console.error('❌ skill-user-agent not found.');
        console.log('Agents found:', agents.map(a => a.name).join(', '));
    }
}

verifySkillUserAgent().catch(console.error);
