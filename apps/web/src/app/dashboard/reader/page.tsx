"use client";

import { trpc } from "@/utils/trpc";
import { useState } from "react";

export default function ReaderPage() {
    const [url, setUrl] = useState("");
    const executeTool = trpc.executeTool.useMutation();
    const [result, setResult] = useState<string | null>(null);

    const handleRead = async () => {
        if (!url) return;
        try {
            const output = await executeTool.mutateAsync({
                name: "read_page",
                args: { url }
            });
            setResult(typeof output === 'string' ? output : JSON.stringify(output, null, 2));
        } catch (e: any) {
            setResult(`Error: ${e.message}`);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Page Reader</h1>
                <p className="text-zinc-400">Scrape and convert any webpage to Markdown for LLM consumption.</p>
            </div>

            <div className="flex gap-4">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/docs"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleRead()}
                />
                <button
                    onClick={handleRead}
                    disabled={executeTool.isPending || !url}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
                >
                    {executeTool.isPending ? "Reading..." : "Read Page"}
                </button>
            </div>

            {result && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Markdown Output</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(result)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                    <div className="prose prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {result}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
