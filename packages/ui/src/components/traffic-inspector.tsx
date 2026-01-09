"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Activity, Clock, Database, Code, MessageSquare, Terminal, Search, RefreshCw } from "lucide-react";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ContextAnalysis {
    system: number;
    user: number;
    tool_output: number;
    memory: number;
    code: number;
    total: number;
    segments: Array<{
        type: string;
        preview: string;
        length: number;
        percentage: number;
    }>;
}

interface LogEntry {
    id: string;
    timestamp: number;
    type: 'request' | 'response' | 'error';
    tool: string;
    args?: {
        contextAnalysis?: ContextAnalysis;
        [key: string]: any;
    };
    result?: any;
    error?: any;
    duration?: number;
}

export function TrafficInspector() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/logs?limit=100');
            const data = await res.json();
            setLogs(data);
            if (!selectedLog && data.length > 0) {
                setSelectedLog(data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter(log => 
        log.tool.toLowerCase().includes(filter.toLowerCase()) ||
        log.type.toLowerCase().includes(filter.toLowerCase())
    );

    const getStatusColor = (type: string) => {
        switch (type) {
            case 'error': return 'bg-red-500';
            case 'response': return 'bg-green-500';
            default: return 'bg-blue-500';
        }
    };

    const renderContextBar = (analysis: ContextAnalysis) => {
        if (!analysis) return null;
        
        const getWidth = (val: number) => `${(val / analysis.total) * 100}%`;
        
        return (
            <div className="space-y-2 mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Context Composition ({analysis.total} chars)</span>
                </div>
                <div className="h-4 w-full flex rounded-full overflow-hidden bg-secondary">
                    <div style={{ width: getWidth(analysis.system) }} className="bg-slate-500" title={`System: ${analysis.system}`} />
                    <div style={{ width: getWidth(analysis.memory) }} className="bg-purple-500" title={`Memory: ${analysis.memory}`} />
                    <div style={{ width: getWidth(analysis.user) }} className="bg-blue-500" title={`User: ${analysis.user}`} />
                    <div style={{ width: getWidth(analysis.code) }} className="bg-yellow-500" title={`Code: ${analysis.code}`} />
                    <div style={{ width: getWidth(analysis.tool_output) }} className="bg-orange-500" title={`Tool: ${analysis.tool_output}`} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs mt-2">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500" /> System ({Math.round(analysis.system/analysis.total*100)}%)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" /> Memory ({Math.round(analysis.memory/analysis.total*100)}%)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> User ({Math.round(analysis.user/analysis.total*100)}%)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Code ({Math.round(analysis.code/analysis.total*100)}%)</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Tool ({Math.round(analysis.tool_output/analysis.total*100)}%)</div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
            {/* Left Sidebar: Log List */}
            <Card className="w-1/3 flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                        Traffic Logs
                        <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Filter logs..." 
                            className="pl-8" 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full">
                        <div className="flex flex-col gap-1 p-2">
                            {filteredLogs.map(log => (
                                <button
                                    key={log.id}
                                    onClick={() => setSelectedLog(log)}
                                    className={`flex flex-col items-start p-3 rounded-lg text-left transition-colors hover:bg-accent ${
                                        selectedLog?.id === log.id ? 'bg-accent' : ''
                                    }`}
                                >
                                    <div className="flex w-full justify-between items-center mb-1">
                                        <span className="font-medium text-sm">{log.tool}</span>
                                        <Badge variant="outline" className={`text-[10px] h-5 ${getStatusColor(log.type)} text-white border-none`}>
                                            {log.type}
                                        </Badge>
                                    </div>
                                    <div className="flex w-full justify-between text-xs text-muted-foreground">
                                        <span>{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                                        {log.duration && <span>{log.duration}ms</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Right Panel: Details */}
            <Card className="flex-1 flex flex-col overflow-hidden">
                {selectedLog ? (
                    <>
                        <CardHeader className="border-b pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        {selectedLog.tool}
                                        <Badge variant="secondary">{selectedLog.type}</Badge>
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        ID: {selectedLog.id} • {format(new Date(selectedLog.timestamp), 'PPpp')}
                                    </CardDescription>
                                </div>
                                {selectedLog.duration && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground bg-secondary px-2 py-1 rounded">
                                        <Clock className="h-3 w-3" />
                                        {selectedLog.duration}ms
                                    </div>
                                )}
                            </div>
                            
                            {/* Context Visualization */}
                            {selectedLog.args?.contextAnalysis && renderContextBar(selectedLog.args.contextAnalysis)}
                        </CardHeader>
                        
                        <CardContent className="flex-1 overflow-hidden p-0">
                            <Tabs defaultValue="payload" className="h-full flex flex-col">
                                <div className="px-4 pt-2 border-b">
                                    <TabsList>
                                        <TabsTrigger value="payload">Payload</TabsTrigger>
                                        <TabsTrigger value="analysis" disabled={!selectedLog.args?.contextAnalysis}>Context Analysis</TabsTrigger>
                                        <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="payload" className="flex-1 overflow-hidden p-0 m-0">
                                    <ScrollArea className="h-full p-4">
                                        <div className="space-y-4">
                                            {selectedLog.args && (
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                        <Terminal className="h-4 w-4" /> Arguments
                                                    </h3>
                                                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[300px]">
                                                        {JSON.stringify(selectedLog.args, (key, value) => {
                                                            if (key === 'contextAnalysis') return undefined; // Hide from main view
                                                            return value;
                                                        }, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                            
                                            {selectedLog.result && (
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                        <Activity className="h-4 w-4" /> Result
                                                    </h3>
                                                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[300px]">
                                                        {JSON.stringify(selectedLog.result, null, 2)}
                                                    </pre>
                                                </div>
                                            )}

                                            {selectedLog.error && (
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2 text-red-500 flex items-center gap-2">
                                                        <Activity className="h-4 w-4" /> Error
                                                    </h3>
                                                    <pre className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-xs overflow-auto">
                                                        {JSON.stringify(selectedLog.error, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="analysis" className="flex-1 overflow-hidden p-0 m-0">
                                    <ScrollArea className="h-full p-4">
                                        {selectedLog.args?.contextAnalysis?.segments.map((segment, i) => (
                                            <div key={i} className="mb-4 border rounded-lg overflow-hidden">
                                                <div className="bg-muted px-3 py-2 flex justify-between items-center text-xs font-medium">
                                                    <span className="uppercase">{segment.type}</span>
                                                    <span>{segment.length} chars ({segment.percentage.toFixed(1)}%)</span>
                                                </div>
                                                <pre className="p-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono bg-background">
                                                    {segment.preview}
                                                </pre>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="raw" className="flex-1 overflow-hidden p-0 m-0">
                                    <ScrollArea className="h-full p-4">
                                        <pre className="text-xs font-mono">
                                            {JSON.stringify(selectedLog, null, 2)}
                                        </pre>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a log entry to view details
                    </div>
                )}
            </Card>
        </div>
    );
}
