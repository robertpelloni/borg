"use client";
import { trpc } from "../utils/trpc";
import { useState, useEffect } from "react";

export default function ConfigEditor() {
    const configQuery = trpc.config.readAntigravity.useQuery();
    const saveMutation = trpc.config.writeAntigravity.useMutation();

    const [jsonContent, setJsonContent] = useState<string>("");
    const [status, setStatus] = useState<string>("");

    useEffect(() => {
        if (configQuery.data) {
            setJsonContent(JSON.stringify(configQuery.data, null, 4));
        }
    }, [configQuery.data]);

    const handleSave = async () => {
        try {
            setStatus("Saving...");
            await saveMutation.mutateAsync({ content: jsonContent });
            setStatus("Saved successfully!");
            setTimeout(() => setStatus(""), 3000);
            configQuery.refetch();
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
    };

    if (configQuery.isLoading) return <div className="p-4">Loading Config...</div>;

    return (
        <div className="p-6 border rounded-lg bg-zinc-900 text-zinc-100 shadow-md w-full max-w-2xl mt-8">
            <h2 className="text-xl font-bold mb-4">⚙️ Antigravity Config (mcp.json)</h2>
            <div className="relative">
                <textarea
                    className="w-full h-96 bg-black font-mono text-sm p-4 border border-zinc-700 rounded focus:border-blue-500 outline-none"
                    value={jsonContent}
                    onChange={(e) => setJsonContent(e.target.value)}
                />
            </div>
            <div className="flex justify-between items-center mt-4">
                <span className={`text-sm ${status.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                    {status}
                </span>
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded font-medium disabled:opacity-50"
                >
                    {saveMutation.isPending ? "Saving..." : "Save Config"}
                </button>
            </div>
        </div>
    );
}
