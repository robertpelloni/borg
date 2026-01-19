
import * as lancedb from "vectordb";
import path from "path";
import os from "os";

export interface CodeChunk {
    id: string;
    file_path: string;
    content: string;
    language: string;
    start_line: number;
    end_line: number;
    vector: number[];
}

export class VectorStore {
    private db: lancedb.Connection | null = null;
    private table: lancedb.Table | null = null;

    constructor(private dbPath: string = path.join(os.homedir(), ".aios", "lancedb")) { }

    async init() {
        this.db = await lancedb.connect(this.dbPath);
        // Determine existing tables, create if not exist. 
        // Note: LanceDB node API might differ slightly in table listing.
        const tableNames = await this.db.tableNames();
        if (!tableNames.includes("code_chunks")) {
            // Creating a dummy entry to define schema is a common pattern if explicit schema def is tricky depending on version
            // But let's try to just open it if exists, else create with data.
        }
    }

    async createTable(data: CodeChunk[]) {
        if (!this.db) await this.init();
        const dataObjects = data.map(d => ({ ...d } as Record<string, unknown>));
        // Cast options to any to bypass strict check if mode is widely supported at runtime
        this.table = await this.db!.createTable("code_chunks", dataObjects, { mode: "overwrite" } as any);
    }

    async add(data: CodeChunk[]) {
        if (!this.table) {
            await this.createTable(data);
        } else {
            const dataObjects = data.map(d => ({ ...d } as Record<string, unknown>));
            await this.table.add(dataObjects);
        }
    }

    async search(queryVector: number[], limit = 5): Promise<CodeChunk[]> {
        if (!this.table) return [];
        // vectordb search returns a Query builder, likely needs execute()
        const results = await this.table.search(queryVector).limit(limit).execute();
        return results as unknown as CodeChunk[];
    }
}
