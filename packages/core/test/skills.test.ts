
import { SkillManager } from '../src/managers/SkillManager.js';
import { PromptDriver, ScriptDriver } from '../src/skills/drivers/index.js';
import * as path from 'path';

async function runTests() {
    console.log('Starting Skill Manager Integration Tests...');

    // Initialize Skill Manager
    // We point to the real registry file since we are in the repo
    const registryPath = path.resolve(process.cwd(), 'packages/core/data/skills_registry.json');
    const skillManager = new SkillManager(registryPath);
    await skillManager.initialize();

    const skills = skillManager.listSkills();
    console.log(`Loaded ${skills.length} skills.`);

    if (skills.length === 0) {
        console.error('FAIL: Registry is empty.');
        process.exit(1);
    }

    // Test 1: Load a Prompt Skill (Algorithmic Art)
    console.log('\nTest 1: Load Algorithmic Art (Anthropic/Prompt)');
    try {
        const artSkillId = 'anthropic_algorithmic-art';
        const artSkillDef = skillManager.getSkillDefinition(artSkillId);
        
        if (!artSkillDef) throw new Error(`${artSkillId} not found in registry`);
        
        // Manual path fixup for test environment if needed
        // The registry paths are relative to repo root, but we run from packages/core usually?
        // SkillManager uses process.cwd(). Let's assume we run from repo root.
        
        const loadedSkill = await skillManager.loadSkill(artSkillId);
        if (loadedSkill?.type !== 'prompt') {
            throw new Error(`Expected type 'prompt', got ${loadedSkill?.type}`);
        }
        
        console.log('PASS: Loaded Algorithmic Art skill.');

        // Test Execution (Should return system prompt)
        const result = await skillManager.executeSkill(artSkillId, {});
        if (result.role === 'system' && result.content) {
             console.log('PASS: Execution returned system prompt.');
        } else {
             throw new Error('Execution result format incorrect');
        }

    } catch (e: any) {
        console.error('FAIL Test 1:', e.message);
        // Don't exit, try next
    }

    // Test 2: Load a Script Skill (GitHub Fix CI - OpenAI/Python)
    // NOTE: This test requires Python.
    console.log('\nTest 2: Load GitHub Fix CI (OpenAI/Script)');
    try {
        const scriptSkillId = 'openai_gh-fix-ci';
        
        // Check if we have python
        // This is just a load test, so we don't strictly need to EXECUTE if we don't want to spawn processes in CI
        // But we want to verify the driver logic finding the script.
        
        const loadedSkill = await skillManager.loadSkill(scriptSkillId);
        if (loadedSkill?.type !== 'script') {
             throw new Error(`Expected type 'script', got ${loadedSkill?.type}`);
        }
        
        if (!loadedSkill.executablePath || !loadedSkill.executablePath.endsWith('.py')) {
             throw new Error(`Executable path incorrect: ${loadedSkill.executablePath}`);
        }
        
        console.log('PASS: Loaded GitHub Fix CI skill and found python script.');
        
    } catch (e: any) {
        console.error('FAIL Test 2:', e.message);
    }

    console.log('\nTests completed.');
}

runTests().catch(console.error);
