'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface ContextStats {
    system: number;
    user: number;
    tool_output: number;
    memory: number;
    code: number;
    total: number;
    segments: {
        type: string;
        preview: string;
        length: number;
        percentage: number;
    }[];
}

const COLORS: Record<string, string> = {
    system: '#8884d8',
    user: '#0088FE',
    tool_output: '#00C49F',
    memory: '#FFBB28',
    code: '#FF8042'
};

export default function ContextPage() {
    const [stats, setStats] = useState<ContextStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        // Poll every 5 seconds
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/context/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch context stats", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!stats) {
        return <div className="p-8 text-center">No active context found.</div>;
    }

    const chartData = [
        { name: 'System', value: stats.system },
        { name: 'User', value: stats.user },
        { name: 'Tools', value: stats.tool_output },
        { name: 'Memory', value: stats.memory },
        { name: 'Code', value: stats.code },
    ].filter(d => d.value > 0);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold">Context Inspector</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visual Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle>Composition (Characters)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={COLORS[entry.name.toLowerCase().replace('tools', 'tool_output')] || '#888'} 
                                        />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle>Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between border-b pb-2">
                            <span>Total Size</span>
                            <span className="font-mono font-bold">{stats.total.toLocaleString()} chars</span>
                        </div>
                        <div className="space-y-2">
                            {chartData.map((item) => (
                                <div key={item.name} className="flex justify-between text-sm">
                                    <span className="flex items-center">
                                        <div 
                                            className="w-3 h-3 rounded-full mr-2" 
                                            style={{ backgroundColor: COLORS[item.name.toLowerCase().replace('tools', 'tool_output')] }} 
                                        />
                                        {item.name}
                                    </span>
                                    <span>{((item.value / stats.total) * 100).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Layer Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Context Layers</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                            {stats.segments.map((segment, i) => (
                                <div key={i} className="p-3 border rounded-lg flex justify-between items-center hover:bg-accent/50">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="capitalize">{segment.type}</Badge>
                                            <span className="text-xs text-muted-foreground">{segment.length} chars</span>
                                        </div>
                                        <div className="text-sm font-mono text-muted-foreground truncate w-[500px]">
                                            {segment.preview}
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold">
                                        {segment.percentage.toFixed(1)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
