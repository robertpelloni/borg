
"use client";

import { trpc } from '../utils/trpc';
import { useEffect, useRef, useState } from 'react';

export function TraceViewer() {
    const [enabled, setEnabled] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Poll logs every 2 seconds
    const logsQuery = trpc.logs.read.useQuery(
        { lines: 100 },
        {
            refetchInterval: enabled ? 2000 : false,
            refetchOnWindowFocus: false
        }
    );

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logsQuery.data, autoScroll]);

    return (
        <div className="p-6 bg-[#1e1e1e] rounded-xl border border-[#333] shadow-lg flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Supervisor Trace</h2>
                    <p className="text-gray-400 text-sm">Live loop activity and autonomous decisions</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${autoScroll
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                            : 'bg-[#333] text-gray-400 border border-[#444] hover:bg-[#444]'
                            }`}
                    >
                        {autoScroll ? '⬇ Locked' : '✋ Manual'}
                    </button>
                    <button
                        onClick={() => setEnabled(!enabled)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${enabled
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                            }`}
                    >
                        {enabled ? '● Live' : '○ Paused'}
                    </button>
                    <button
                        onClick={() => logsQuery.refetch()}
                        className="p-1 hover:bg-[#333] rounded text-gray-400"
                        title="Refresh"
                    >
                        ↻
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-[#111] rounded p-4 overflow-y-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
                {logsQuery.isLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Loading traces...
                    </div>
                ) : logsQuery.error ? (
                    <div className="text-red-400">
                        Failed to load logs: {logsQuery.error.message}
                    </div>
                ) : (
                    <>
                        {logsQuery.data || "No logs available."}
                        <div ref={bottomRef} />
                    </>
                )}
            </div>
        </div>
    );
}
