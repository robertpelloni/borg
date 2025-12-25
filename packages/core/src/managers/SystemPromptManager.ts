import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export class SystemPromptManager extends EventEmitter {
    private filePath: string;
    private content: string = "";

    constructor(rootDir: string) {
        super();
        this.filePath = path.join(rootDir, 'SYSTEM.md');
        this.load();
        this.watch();
    }

    private load() {
        if (fs.existsSync(this.filePath)) {
            this.content = fs.readFileSync(this.filePath, 'utf-8');
        } else {
            this.content = "You are a helpful AI assistant within the Super AI Plugin ecosystem.";
            this.save(this.content);
        }
    }

    private watch() {
        fs.watchFile(this.filePath, () => {
            this.load();
            this.emit('updated', this.content);
        });
    }

    getPrompt() {
        return this.content;
    }

    save(newContent: string) {
        this.content = newContent;
        fs.writeFileSync(this.filePath, newContent);
        this.emit('updated', this.content);
    }
}
