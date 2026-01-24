'use server';

import fs from 'fs/promises';
import path from 'path';

// Adjust path relative to apps/web
const CONFIG_PATH = path.resolve(process.cwd(), '../../packages/core/config/council.json');

export async function getCouncilConfig() {
    try {
        const content = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error("Failed to read council config:", e);
        // Return default if missing
        return {
            members: [
                { name: "The Architect", provider: "ollama", modelId: "gemma", systemPrompt: "Default architect." }
            ]
        };
    }
}

export async function saveCouncilConfig(config: any) {
    try {
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf-8');
        return { success: true };
    } catch (e: any) {
        console.error("Failed to save config:", e);
        return { success: false, error: e.message };
    }
}
