"use client";

import { TrafficInspector } from "@/components/TrafficInspector";
import Link from "next/link";

export default function InspectorPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Traffic Inspector</h1>
                    <p className="text-zinc-500">Real-time packet capture of MCP tool events</p>
                </div>
                <Link
                    href="/dashboard"
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                    ← Back to Mission Control
                </Link>
            </div>

            <TrafficInspector />

            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
                <h3 className="text-sm font-bold text-zinc-400 mb-2">Protocol Info</h3>
                <p className="text-xs text-zinc-600 font-mono">
                    BRIDGE: ws://localhost:3001<br />
                    EVENTS: TOOL_CALL_START, TOOL_CALL_END<br />
                    CLIENT: Generic WebSocket (Browser)
                </p>
            </div>
        </div>
    );
}
