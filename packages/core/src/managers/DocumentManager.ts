import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { MemoryManager } from './MemoryManager.js';
// We use a require here because pdf-parse might not be fully ESM compatible in this env
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

import { IngestionManager } from './IngestionManager.js';

/**
 * Manages document ingestion (PDF, txt, md) from a watched directory.
 * Chunks content and stores it in the MemoryManager for retrieval.
 */
export class DocumentManager extends EventEmitter {
    private watcher: fs.FSWatcher | null = null;

    constructor(
        private docDir: string, 
        private memoryManager: MemoryManager,
        private ingestionManager?: IngestionManager
    ) {
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
        this.scanDocs();
        this.watcher = fs.watch(this.docDir, (eventType, filename) => {
            if (filename) {
                this.processFile(path.join(this.docDir, filename));
            }
        });
    }

    private scanDocs() {
        if (!fs.existsSync(this.docDir)) return;
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
                const dataBuffer = fs.readFileSync(filepath);
                const data = await pdf(dataBuffer);
                content = data.text;
            } else {
                return;
            }

            // Smart Ingestion (Summarization + Fact Extraction)
            if (this.ingestionManager) {
                console.log(`[DocumentManager] Smart ingesting ${path.basename(filepath)}...`);
                await this.ingestionManager.ingest(path.basename(filepath), content, { tags: ['document', ext] });
            }

            // Simple Chunking Strategy (by paragraphs or char limit)
            // We still keep this for raw retrieval
            const chunks = this.chunkText(content, 1000); // 1000 char chunks

            for (let i = 0; i < chunks.length; i++) {
                await this.memoryManager.remember({
                    content: chunks[i],
                    tags: ['document', ext, path.basename(filepath), `chunk:${i}`]
                });
            }

            console.log(`[DocumentManager] Ingested ${path.basename(filepath)} (${chunks.length} chunks)`);
            this.emit('ingested', { file: path.basename(filepath) });

        } catch (error) {
            console.error(`[DocumentManager] Error processing ${filepath}:`, error);
        }
    }

    private chunkText(text: string, size: number): string[] {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.substring(i, i + size));
        }
        return chunks;
    }
}
