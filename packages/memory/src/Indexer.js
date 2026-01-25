import fs from 'fs/promises';
import path from 'path';
import { CodeSplitter } from './CodeSplitter.js';
import crypto from 'crypto';
// Basic list of extensions to index
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.css', '.html']);
export class Indexer {
    vectorStore;
    maxChunkSize = 500; // chars approx for now? or tokens. Simple chars for speed.
    constructor(vectorStore) {
        this.vectorStore = vectorStore;
    }
    async indexDirectory(rootDir) {
        console.log(`[Indexer] Scanning ${rootDir}...`);
        await this.vectorStore.initialize();
        const files = await this.walk(rootDir);
        const codeDocs = [];
        for (const file of files) {
            // Compute relative path for ID
            const relPath = path.relative(rootDir, file);
            try {
                const content = await fs.readFile(file, 'utf-8');
                const fileHash = crypto.createHash('md5').update(content).digest('hex');
                // Check if already indexed? 
                // For MVP, we overwrite or just append. 
                // Real impl should check hash in DB. (Skipped for speed in MVP)
                // Chunking
                const chunks = CodeSplitter.split(content, path.extname(file));
                chunks.forEach((chunk, index) => {
                    codeDocs.push({
                        id: `${relPath}#${index}`,
                        file_path: relPath,
                        content: chunk,
                        hash: fileHash
                    });
                });
            }
            catch (e) {
                console.error(`[Indexer] Error processing ${relPath}: ${e.message}`);
            }
        }
        if (codeDocs.length > 0) {
            // Batch add
            // Lancedb handles batching, but we can do it in chunks of 100 too to prevent OOM
            const BATCH_SIZE = 50;
            for (let i = 0; i < codeDocs.length; i += BATCH_SIZE) {
                const batch = codeDocs.slice(i, i + BATCH_SIZE);
                await this.vectorStore.addDocuments(batch);
                console.log(`[Indexer] Indexed batch ${i}-${i + BATCH_SIZE} / ${codeDocs.length}`);
            }
        }
        return codeDocs.length;
    }
    async walk(dir) {
        let results = [];
        try {
            const list = await fs.readdir(dir);
            for (const file of list) {
                const filepath = path.join(dir, file);
                const stat = await fs.stat(filepath);
                if (stat && stat.isDirectory()) {
                    // Ignore common junk
                    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(file))
                        continue;
                    results = results.concat(await this.walk(filepath));
                }
                else {
                    if (EXTENSIONS.has(path.extname(filepath))) {
                        results.push(filepath);
                    }
                }
            }
        }
        catch (e) { /* ignore access errors */ }
        return results;
    }
}
