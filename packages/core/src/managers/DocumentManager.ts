import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { MemoryManager } from './MemoryManager.js';

/**
 * Manages document ingestion (PDF, txt, md) from a watched directory.
 * Chunks content and stores it in the MemoryManager for retrieval.
 */
export class DocumentManager extends EventEmitter {
    private watcher: fs.FSWatcher | null = null;

    constructor(private docDir: string, private memoryManager: MemoryManager) {
        super();
        this.ensureDir();
        this.startWatching();
    }

    private ensureDir() {
        if (!fs.existsSync(this.docDir)) {
            fs.mkdirSync(this.docDir, { recursive: true });
        }
    }

    private startWatching() {
        // Initial scan
        this.scanDocs();

        this.watcher = fs.watch(this.docDir, (eventType, filename) => {
            if (filename) {
                console.log(`[DocumentManager] File changed: ${filename}`);
                this.processFile(path.join(this.docDir, filename));
            }
        });
    }

    private scanDocs() {
        const files = fs.readdirSync(this.docDir);
        for (const file of files) {
            this.processFile(path.join(this.docDir, file));
        }
    }

    private async processFile(filepath: string) {
        if (!fs.existsSync(filepath)) return;
        const stat = fs.statSync(filepath);
        if (!stat.isFile()) return;

        const ext = path.extname(filepath).toLowerCase();
        let content = '';

        try {
            if (ext === '.txt' || ext === '.md' || ext === '.json') {
                content = fs.readFileSync(filepath, 'utf-8');
            } else if (ext === '.pdf') {
                // Mock PDF extraction for now since we don't want heavy dependencies
                // in this environment unless requested.
                content = `[PDF Content Placeholder for ${path.basename(filepath)}]`;
            } else {
                return;
            }

            // Chunk and store
            await this.memoryManager.remember(`document:${path.basename(filepath)}`, content, ['document', ext]);
            console.log(`[DocumentManager] Ingested ${path.basename(filepath)}`);
            this.emit('ingested', { file: path.basename(filepath) });

        } catch (error) {
            console.error(`[DocumentManager] Error processing ${filepath}:`, error);
        }
    }
}
