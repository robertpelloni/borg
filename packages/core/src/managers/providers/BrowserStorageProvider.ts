import { MemoryProvider, Memory, MemoryResult } from '../../interfaces/MemoryProvider.js';
import { BrowserManager } from '../BrowserManager.js';

export class BrowserStorageProvider implements MemoryProvider {
    id = 'browser-storage';
    name = 'Browser History & Bookmarks';
    type: 'external' = 'external';
    capabilities: ('read' | 'write' | 'search' | 'delete')[] = ['search', 'read'];

    constructor(private browserManager: BrowserManager) {}

    async init(): Promise<void> {
        // Connection is managed by BrowserManager socket
        if (!this.browserManager.isConnected()) {
            console.warn('[BrowserStorageProvider] Browser not connected yet.');
        }
    }

    async store(memory: Memory): Promise<string> {
        // Browser history is read-only for now
        console.warn('[BrowserStorageProvider] Store not supported (Read-Only)');
        return "";
    }

    async retrieve(id: string): Promise<Memory | null> {
        // Not directly supported by ID yet without search
        return null;
    }

    async search(query: string, limit: number = 5): Promise<MemoryResult[]> {
        if (!this.browserManager.isConnected()) {
            return [];
        }

        try {
            const history = await this.browserManager.searchHistory(query, limit);
            const bookmarks = await this.browserManager.getBookmarks(query);

            const results: MemoryResult[] = [];

            // Map History
            results.push(...history.map((h: any) => ({
                id: `history-${h.id}`,
                content: `[Browser History] ${h.title} - ${h.url}`,
                tags: ['browser', 'history'],
                timestamp: h.lastVisitTime || Date.now(),
                sourceProvider: this.id,
                metadata: {
                    url: h.url,
                    visitCount: h.visitCount,
                    source: 'browser-history'
                }
            })));

            // Map Bookmarks
            results.push(...bookmarks.map((b: any) => ({
                id: `bookmark-${b.id}`,
                content: `[Browser Bookmark] ${b.title} - ${b.url}`,
                tags: ['browser', 'bookmark'],
                timestamp: b.dateAdded || Date.now(),
                sourceProvider: this.id,
                metadata: {
                    url: b.url,
                    source: 'browser-bookmark'
                }
            })));

            return results;

        } catch (e) {
            console.error('[BrowserStorageProvider] Search failed:', e);
            return [];
        }
    }

    async delete(id: string): Promise<void> {
        // Not supported
    }
}
