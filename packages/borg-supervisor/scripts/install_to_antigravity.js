import { Installer } from '../dist/installer.js';

async function install() {
    console.log("Installing Borg Supervisor to Antigravity...");
    // Default path is already set in Installer class to:
    // C:\Users\hyper\AppData\Roaming\Antigravity\User\mcp.json
    const installer = new Installer();

    try {
        const result = await installer.install();
        console.log(result);
    } catch (err) {
        console.error("Installation failed:", err);
        process.exit(1);
    }
}

install();
