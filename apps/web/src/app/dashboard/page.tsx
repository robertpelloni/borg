"use client";

import { trpc } from "@/utils/trpc";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function DashboardHome() {
    const { data: health } = trpc.health.useQuery();
    const { data: status, refetch: refetchStatus } = trpc.director.status.useQuery(undefined, {
        refetchInterval: 2000 // Poll every 2s
    });

    const startMutation = trpc.director.startAutoDrive.useMutation({
        onSuccess: () => refetchStatus()
    });

    const stopMutation = trpc.director.stopAutoDrive.useMutation({
        onSuccess: () => refetchStatus()
    });

    const isDriving = status?.active;

    return (
        <div className="space-y-8">
            {/* Header / Status Banner */}
            <div className="flex items-center justify-between p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-sm backdrop-blur-sm">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Mission Control</h1>
                    <div className="flex items-center space-x-2 text-zinc-400 text-sm">
                        <span className={`w-2 h-2 rounded-full ${health?.status === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                        <span>System: {health?.status === 'running' ? 'OPERATIONAL' : 'DISCONNECTED'}</span>
                        <span className="text-zinc-600">|</span>
                        <span>Service: {health?.service}</span>
                    </div>
                </div>

                {/* Agent Control Panel */}
                <div className="flex items-center space-x-4 bg-black/40 p-2 rounded-xl border border-zinc-800/50">
                    <div className="px-4 text-right">
                        <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Director Status</div>
                        <div className={`text-lg font-bold ${isDriving ? 'text-blue-400 animate-pulse' : 'text-zinc-400'}`}>
                            {status?.status || 'UNKNOWN'}
                        </div>
                    </div>

                    {isDriving ? (
                        <button
                            onClick={() => stopMutation.mutate()}
                            disabled={stopMutation.isLoading}
                            className="h-12 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                            {stopMutation.isLoading ? 'STOPPING...' : '⏹ STOP AUTO-DRIVE'}
                        </button>
                    ) : (
                        <button
                            onClick={() => startMutation.mutate()}
                            disabled={startMutation.isLoading}
                            className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                            {startMutation.isLoading ? 'STARTING...' : '▶ ENGAGE AUTO-DRIVE'}
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ShortcutCard
                    title="Skills Library"
                    desc="Inspect available capabilities"
                    href="/dashboard/skills"
                    icon="⚡"
                    color="text-yellow-400"
                />
                <ShortcutCard
                    title="Page Reader"
                    desc="Scrape & convert web content"
                    href="/dashboard/reader"
                    icon="📖"
                    color="text-orange-400"
                />
                <ShortcutCard
                    title="Config Editor"
                    desc="Manage system settings"
                    href="/dashboard/config"
                    icon="⚙️"
                    color="text-zinc-400"
                />
                <ShortcutCard
                    title="System Logs"
                    desc="View live stream (Coming Soon)"
                    href="/dashboard/logs"
                    icon="terminal"
                    color="text-green-400"
                />
            </div>

            {/* Recent Activity / Context (Placeholder) */}
            <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                <h3 className="text-lg font-medium text-white mb-4">Current Objective</h3>
                <div className="bg-black/40 p-4 rounded-lg border border-zinc-800 font-mono text-sm text-zinc-300">
                    {status?.goal ? (
                        <span>{status.goal}</span>
                    ) : (
                        <span className="text-zinc-600 italic">No active goal context via search...</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function ShortcutCard({ title, desc, href, icon, color }: any) {
    return (
        <Link href={href} className="group p-5 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 rounded-xl transition-all">
            <div className="flex items-start justify-between mb-3">
                <span className={`text-2xl ${color}`}>{icon === 'terminal' ? <span className="font-mono text-lg">_&gt;</span> : icon}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500">↗</span>
            </div>
            <h3 className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{title}</h3>
            <p className="text-sm text-zinc-500">{desc}</p>
        </Link>
    );
}
