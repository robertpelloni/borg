'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Database, RefreshCw, HardDrive, Cloud, Brain, Server } from 'lucide-react';
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  similarity?: number;
}

export default function MemoryPage() {
  const [providers, setProviders] = useState<MemoryProvider[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ingestContent, setIngestContent] = useState('');
  const [ingestTags, setIngestTags] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('memories');
  
  // View Modal State
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [snapshotContent, setSnapshotContent] = useState<string>('');
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
    fetchSnapshots();
  }, []);

  const fetchProviders = async () => {
    try {
        const res = await fetch('/api/memory/providers');
        const data = await res.json();
        setProviders(data);
    } catch (error) {
        console.error("Failed to fetch providers", error);
        toast.error("Failed to fetch providers");
    }
  };

  const fetchSnapshots = async () => {
    try {
        const res = await fetch('/api/memory/snapshots');
        const data = await res.json();
        setSnapshots(data);
    } catch (error) {
        console.error("Failed to fetch snapshots", error);
        toast.error("Failed to fetch snapshots");
    }
  };

  const handleRestoreSnapshot = async (filename: string) => {
    try {
        const res = await fetch('/api/memory/snapshots/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (res.ok) {
            toast.success('Snapshot restored successfully!');
        } else {
            toast.error('Failed to restore snapshot');
        }
    } catch (error) {
        console.error("Failed to restore snapshot", error);
        toast.error('Error restoring snapshot');
    }
  };

  const handleViewSnapshot = async (snapshot: any) => {
      setSelectedSnapshot(snapshot);
      setIsViewModalOpen(true);
      setViewLoading(true);
      
      try {
          const res = await fetch('/api/memory/snapshots/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: snapshot.filename })
          });
          
          if (res.ok) {
              const data = await res.json();
              setSnapshotContent(JSON.stringify(data.data, null, 2));
          } else {
              setSnapshotContent("Failed to load content.");
          }
      } catch (e) {
          setSnapshotContent("Error loading content.");
      } finally {
          setViewLoading(false);
      }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
        const res = await fetch(`/api/memory/search?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setMemories(data);
    } catch (error) {
        console.error("Failed to search memories", error);
        toast.error("Failed to search memories");
    } finally {
        setLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!ingestContent.trim()) return;
    setIsIngesting(true);
    try {
        const tags = ingestTags.split(',').map(t => t.trim()).filter(Boolean);
        await fetch('/api/memory/remember', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: ingestContent, tags })
        });
        setIngestContent('');
        setIngestTags('');
        toast.success("Memory stored successfully");
        if (searchQuery) handleSearch();
    } catch (error) {
        console.error("Failed to ingest memory", error);
        toast.error("Failed to save memory");
    } finally {
        setIsIngesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Memory Orchestrator</h1>
        <Button onClick={() => { fetchProviders(); fetchSnapshots(); }} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Provider Status */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" /> Providers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center">
                        {p.type === 'file' ? <HardDrive className="mr-2 h-4 w-4 text-blue-500" /> : 
                         p.type === 'vector' ? <Database className="mr-2 h-4 w-4 text-green-500" /> :
                         p.type === 'external' ? <Cloud className="mr-2 h-4 w-4 text-purple-500" /> :
                         <Brain className="mr-2 h-4 w-4 text-orange-500" />}
                        <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{p.type}</div>
                        </div>
                    </div>
                    <Badge variant="secondary">Connected</Badge>
                </div>
            ))}
            <Button className="w-full" variant="ghost">Add Provider</Button>
          </CardContent>
        </Card>

        {/* Memory Actions & Explorer */}
        <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="memories" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="memories">Memories</TabsTrigger>
                    <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
                </TabsList>

                <TabsContent value="memories" className="space-y-6">
                    {/* Ingest Memory */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Remember New Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Input 
                                    placeholder="What should I remember?" 
                                    value={ingestContent}
                                    onChange={(e) => setIngestContent(e.target.value)}
                                />
                                <Input 
                                    placeholder="Tags (comma separated)..." 
                                    value={ingestTags}
                                    onChange={(e) => setIngestTags(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleIngest} disabled={isIngesting || !ingestContent}>
                                {isIngesting ? 'Saving...' : 'Remember'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Memory Explorer */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Explorer</CardTitle>
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
                                            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex gap-1 flex-wrap">
                                                    {m.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    {m.similarity && <span>Score: {(m.similarity * 100).toFixed(0)}%</span>}
                                                    <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                                                    <span className="capitalize">{m.sourceProvider}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="snapshots">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Context Snapshots</span>
                                <Button size="sm" variant="outline" onClick={fetchSnapshots}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                {snapshots.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-10">
                                        No snapshots found.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {snapshots.map((s: any) => (
                                            <div key={s.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="font-medium">Session: {s.sessionId}</div>
                                                    <Badge>{new Date(s.timestamp).toLocaleDateString()}</Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground mb-3">
                                                    Summary: {s.summary || 'No summary available'}
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleViewSnapshot(s)}>View</Button>
                                                    <Button size="sm" onClick={() => handleRestoreSnapshot(s.filename)}>Restore</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
      </div>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
                <DialogTitle>Snapshot Content</DialogTitle>
                <DialogDescription>
                    Session: {selectedSnapshot?.sessionId}
                </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
                {viewLoading ? (
                    <div className="flex justify-center p-8">Loading...</div>
                ) : (
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/50">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                            {snapshotContent}
                        </pre>
                    </ScrollArea>
                )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
