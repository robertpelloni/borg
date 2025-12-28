import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Database, RefreshCw, HardDrive, Cloud } from 'lucide-react';

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
  const [ingestContent, setIngestContent] = useState('');
  const [ingestTags, setIngestTags] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('memories');

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
    }
  };

  const fetchSnapshots = async () => {
    try {
        const res = await fetch('/api/memory/snapshots');
        const data = await res.json();
        setSnapshots(data);
    } catch (error) {
        console.error("Failed to fetch snapshots", error);
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
        // Refresh search results if query exists, or just clear them
        if (searchQuery) handleSearch();
    } catch (error) {
        console.error("Failed to ingest memory", error);
    } finally {
        setIsIngesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Memory Orchestrator</h1>
        <Button onClick={fetchProviders} variant="outline">
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
                        {p.type === 'file' ? <HardDrive className="mr-2 h-4 w-4 text-blue-500" /> : <Cloud className="mr-2 h-4 w-4 text-purple-500" />}
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
                                            <div className="text-sm">{m.content}</div>
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex gap-1">
                                                    {m.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(m.timestamp).toLocaleDateString()} • {m.sourceProvider}
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
                                                    <Button size="sm" variant="outline">View</Button>
                                                    <Button size="sm">Restore</Button>
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
    </div>
  );
}
