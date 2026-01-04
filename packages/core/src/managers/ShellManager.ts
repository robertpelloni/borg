import fs from 'fs';
import path from 'path';
import os from 'os';

export class ShellManager {
    private homeDir: string;

    constructor() {
        this.homeDir = os.homedir();
    }

    detectShellProfile(): string {
        const shell = process.env.SHELL || '';
        if (shell.includes('zsh')) return path.join(this.homeDir, '.zshrc');
        if (shell.includes('bash')) return path.join(this.homeDir, '.bashrc');
        if (shell.includes('fish')) return path.join(this.homeDir, '.config', 'fish', 'config.fish');
        return path.join(this.homeDir, '.profile'); // Fallback
    }

    async addToProfile(name: string, content: string): Promise<string> {
        const profilePath = this.detectShellProfile();
        const marker = `# aios Configuration for ${name}`;
        const endMarker = `# End aios Configuration for ${name}`;
        
        let currentContent = '';
        if (fs.existsSync(profilePath)) {
            currentContent = fs.readFileSync(profilePath, 'utf-8');
        }

        // Remove existing block if present
        const regex = new RegExp(`${marker}[\\s\\S]*?${endMarker}`, 'g');
        currentContent = currentContent.replace(regex, '').trim();

        const newBlock = `\n${marker}\n${content}\n${endMarker}\n`;
        
        fs.appendFileSync(profilePath, newBlock);
        return profilePath;
    }

    async removeFromProfile(name: string): Promise<boolean> {
        const profilePath = this.detectShellProfile();
        if (!fs.existsSync(profilePath)) return false;

        const marker = `# aios Configuration for ${name}`;
        const endMarker = `# End aios Configuration for ${name}`;
        
        let content = fs.readFileSync(profilePath, 'utf-8');
        const regex = new RegExp(`${marker}[\\s\\S]*?${endMarker}`, 'g');
        
        if (regex.test(content)) {
            content = content.replace(regex, '').trim();
            fs.writeFileSync(profilePath, content);
            return true;
        }
        return false;
    }
}
