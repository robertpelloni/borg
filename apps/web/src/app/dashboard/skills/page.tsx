"use client";

import { trpc } from "@/utils/trpc";
import { useState } from "react";

export default function SkillsPage() {
    const { data: skills, isLoading, refetch } = trpc.skills.list.useQuery();
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Skills Library</h1>
                    <p className="text-zinc-400">Manage and inspect installed capabilities.</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors text-sm font-medium"
                >
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-zinc-500">Loading skills...</div>
                ) : skills?.tools.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        No skills detected in .borg/skills
                    </div>
                ) : (
                    skills?.tools.map((tool: any) => (
                        <div
                            key={tool.name}
                            onClick={() => setSelectedSkill(tool.name)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedSkill === tool.name
                                    ? 'bg-blue-900/20 border-blue-500/50'
                                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <span className="px-2 py-1 text-xs font-mono bg-zinc-950 rounded text-zinc-400">
                                    {tool.name}
                                </span>
                                {tool.inputSchema?.required && (
                                    <span className="px-2 py-1 text-xs bg-red-900/20 text-red-400 rounded">
                                        Complex
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-zinc-300 line-clamp-3">{tool.description}</p>
                        </div>
                    ))
                )}
            </div>

            {selectedSkill && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedSkill(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-white">{selectedSkill}</h2>
                            <button onClick={() => setSelectedSkill(null)} className="text-zinc-400 hover:text-white">✕</button>
                        </div>
                        <SkillDetails skillName={selectedSkill} />
                    </div>
                </div>
            )}
        </div>
    );
}

function SkillDetails({ skillName }: { skillName: string }) {
    const { data: details, isLoading } = trpc.skills.read.useQuery({ name: skillName });

    if (isLoading) return <div className="py-10 text-center text-zinc-500">Loading details...</div>;

    return (
        <div className="space-y-4">
            <div className="prose prose-invert max-w-none">
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm font-mono text-zinc-300">
                    {JSON.stringify(details, null, 2)}
                </pre>
            </div>
        </div>
    );
}
