
"use client";
import { trpc } from "../utils/trpc";

export default function IndexingStatus() {
    const status = trpc.indexingStatus.useQuery();

    if (!status.data) return <div className="text-zinc-500">Connecting to Indexer...</div>;

    return (
        <div className="p-4 border rounded bg-slate-900 text-white mt-4 w-full">
            <h2 className="text-xl font-bold mb-2">Deep Code Intelligence</h2>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-zinc-400">Status</p>
                    <p className="text-lg font-mono text-blue-400 uppercase">{status.data.status}</p>
                </div>
                <div>
                    <p className="text-sm text-zinc-400">Files Indexed</p>
                    <p className="text-lg font-mono">{status.data.filesIndexed} / {status.data.totalFiles}</p>
                </div>
            </div>
        </div>
    );
}
