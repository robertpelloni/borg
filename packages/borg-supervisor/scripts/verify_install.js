import { Installer } from '../dist/installer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const testConfigPath = path.resolve(__dirname, '../mcp_test.json');
    console.log('Testing installer with:', testConfigPath);

    const installer = new Installer(testConfigPath);
    try {
        const result = await installer.install();
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
