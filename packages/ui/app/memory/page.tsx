'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Database, RefreshCw, HardDrive, Cloud, Brain, Lightbulb, CheckSquare, Download, Upload, Globe, GitBranch } from 'lucide-react';

interface MemoryProvider {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
}

interface MemoryItem {
  id: string;
  content: string;
  tags: string[];
  timestamp: number;
  sourceProvider: string;
}

export default function MemoryPage() {
  const [providers, setProviders] = useState<MemoryProvider[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'fact' | 'decision' | 'action'>('all');

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
        const res = await fetch('http://localhost:3000/api/memory/providers');
        const data = await res.json();
        setProviders(data.providers);
    } catch (err) {
        console.error("Failed to fetch providers", err);
    }
  };

  const handleAction = async (action: string, endpoint: string, body: any = {}) => {
      setActionLoading(action);
      try {
          const res = await fetch(`http://localhost:3000${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
          const data = await res.json();
          alert(data.result || data.error || 'Action completed');
          handleSearch(); // Refresh memories
      } catch (e: any) {
          alert(`Action failed: ${e.message}`);
      } finally {
          setActionLoading(null);
      }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && filterType === 'all') return;
    setLoading(true);
    try {
        // If query is empty but filter is set, search for *
        const q = searchQuery.trim() || '*';
        const res = await fetch(`http://localhost:3000/api/memory/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        let results = data.results.map((r: any) => ({
            id: r.metadata?.id || Math.random().toString(36).substring(7),
            content: r.content,
            tags: r.metadata?.tags || [],
            timestamp: r.metadata?.timestamp || Date.now(),
            sourceProvider: r.providerId
        }));

        if (filterType !== 'all') {
            results = results.filter((r: MemoryItem) => r.tags.includes(filterType) || r.tags.includes(`auto-${filterType}`));
        }

        setMemories(results);
    } catch (err) {
        console.error("Failed to search memories", err);
    } finally {
        setLoading(false);
    }
  };

  // Auto-search when filter changes
  useEffect(() => {
      if (memories.length > 0 || searchQuery) {
          handleSearch();
      }
  }, [filterType]);

  const getIconForTag = (tags: string[]) => {
      if (tags.includes('decision') || tags.includes('auto-decision')) return <CheckSquare className="h-4 w-4 text-green-500" />;
      if (tags.includes('fact') || tags.includes('auto-fact')) return <Brain className="h-4 w-4 text-blue-500" />;
      if (tags.includes('action-item') || tags.includes('auto-action')) return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      return null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Memory Orchestrator</h1>
        <div className="flex gap-2">
            <Button onClick={fetchProviders} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Actions Panel */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" /> Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Sync & Ingest</h3>
                <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => handleAction('browser', '/api/memory/ingest/browser')}
                    disabled={!!actionLoading}
                >
                    <Globe className="mr-2 h-4 w-4" /> 
                    {actionLoading === 'browser' ? 'Ingesting...' : 'Ingest Browser Tab'}
                </Button>
                <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => handleAction('jules', '/api/memory/sync/jules')}
                    disabled={!!actionLoading}
                >
                    <Cloud className="mr-2 h-4 w-4" /> 
                    {actionLoading === 'jules' ? 'Syncing...' : 'Sync Jules Sessions'}
                </Button>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Backup & Restore</h3>
                <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => {
                        const path = prompt("Enter export path (absolute):", "C:/Users/hyper/workspace/AIOS/.aios/memory_export.json");
                        if (path) handleAction('export', '/api/memory/export', { filePath: path });
                    }}
                    disabled={!!actionLoading}
                >
                    <Download className="mr-2 h-4 w-4" /> Export to File
                </Button>
                <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => {
                        const path = prompt("Enter import path (absolute):", "C:/Users/hyper/workspace/AIOS/.aios/memory_export.json");
                        if (path) handleAction('import', '/api/memory/import', { filePath: path });
                    }}
                    disabled={!!actionLoading}
                >
                    <Upload className="mr-2 h-4 w-4" /> Import from File
                </Button>
            </div>
          </CardContent>
        </Card>

        {/* Memory Explorer */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>Explorer</CardTitle>
                <div className="flex gap-2">
                    <Button variant={filterType === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('all')}>All</Button>
                    <Button variant={filterType === 'fact' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('fact')}>Facts</Button>
                    <Button variant={filterType === 'decision' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('decision')}>Decisions</Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
                <Input 
                    placeholder="Search memories..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="h-[400px]">
                {memories.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                        No memories found. Try searching.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {memories.map(m => (
                            <div key={m.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1">{getIconForTag(m.tags)}</div>
                                    <div className="flex-1">
                                        <div className="text-sm">{m.content}</div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex gap-1 flex-wrap">
                                                {m.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                                            </div>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                {new Date(m.timestamp).toLocaleDateString()} • {m.sourceProvider}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
