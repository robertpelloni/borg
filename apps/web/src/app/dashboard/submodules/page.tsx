'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { fetchSubmodulesAction } from "./actions";
import { SubmoduleInfo } from "@/lib/git";

export default function SubmodulesPage() {
    const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSubmodulesAction().then(data => {
            setSubmodules(data);
            setLoading(false);
        });
    }, []);

    const cleanCount = submodules.filter(s => s.status === 'clean').length;
    const dirtyCount = submodules.filter(s => s.status === 'dirty').length;
    const missingCount = submodules.filter(s => s.status === 'missing').length;
    const errorCount = submodules.filter(s => s.status === 'error').length;

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Submodule Status</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatusCard title="Clean" value={cleanCount} color="text-green-500" />
                <StatusCard title="Dirty" value={dirtyCount} color="text-yellow-500" />
                <StatusCard title="Missing" value={missingCount} color="text-red-500" />
                <StatusCard title="Errors" value={errorCount} color="text-gray-500" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Repository List ({submodules.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-muted-foreground animate-pulse">Scanning repository... (this performs real-time git checks)</p>
                    ) : (
                        <div className="rounded-md border">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="p-4 font-medium">Path</th>
                                        <th className="p-4 font-medium">Status</th>
                                        <th className="p-4 font-medium">Commit</th>
                                        <th className="p-4 font-medium">URL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submodules.map((sub) => (
                                        <tr key={sub.path} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="p-4 font-mono">{sub.path}</td>
                                            <td className="p-4">
                                                <StatusBadge status={sub.status} />
                                            </td>
                                            <td className="p-4 font-mono text-xs">{sub.lastCommit || '-'}</td>
                                            <td className="p-4 text-xs text-muted-foreground truncate max-w-[200px]">{sub.url}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatusCard({ title, value, color }: { title: string, value: number, color: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
        </Card>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        clean: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        dirty: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
        missing: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        error: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles] || styles.error}`}>
            {status.toUpperCase()}
        </span>
    );
}
