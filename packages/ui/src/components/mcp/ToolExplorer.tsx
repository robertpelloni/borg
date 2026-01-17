'use client';

import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Wrench, Server, Tag, RefreshCw } from 'lucide-react';

interface ToolDefinition {
  name: string;
  description?: string;
  mcpServerId?: string;
  category?: string;
  tags?: string[];
  inputSchema?: any;
}

interface SearchResult {
  tool: ToolDefinition;
  score: number;
  matchType: string;
}

export function ToolExplorer() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedServer, setSelectedServer] = useState('all');

  const fetchTools = async () => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (selectedServer !== 'all') params.append('serverId', selectedServer);

    const res = await fetch(`/api/tools/search?${params.toString()}`);
    const data = await res.json();
    setResults(data.results);
  };

  const fetchStats = async () => {
    const res = await fetch('/api/tools/stats');
    const data = await res.json();
    setStats(data);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(fetchTools, 300);
    return () => clearTimeout(debounce);
  }, [query, selectedCategory, selectedServer]);

  return (
    <div className="flex flex-col h-[600px] bg-gray-900 rounded-xl border border-gray-800">
      <div className="p-4 border-b border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench size={18} /> Tool Explorer
          </h2>
          <div className="flex gap-2">
             {stats && (
                 <>
                    <Badge variant="secondary">{stats.totalTools} Tools</Badge>
                    <Badge variant="secondary">{stats.servers} Servers</Badge>
                 </>
             )}
             <Button variant="ghost" size="icon" onClick={() => { fetchStats(); fetchTools(); }}>
                <RefreshCw size={16} />
             </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search tools (semantic & fuzzy)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 bg-gray-800 border-gray-700"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {stats?.categories?.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((result, idx) => (
            <div key={idx} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 hover:border-blue-500/30 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                  {result.tool.name}
                </h3>
                {result.score > 0 && (
                   <Badge variant="outline" className="text-xs text-gray-500 border-gray-700">
                     {Math.round(result.score * 100)}%
                   </Badge>
                )}
              </div>
              
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                {result.tool.description || "No description provided."}
              </p>

              <div className="flex flex-wrap gap-2 text-xs">
                {result.tool.mcpServerId && (
                  <div className="flex items-center gap-1 text-gray-500 bg-gray-900/50 px-2 py-1 rounded">
                    <Server size={10} />
                    {result.tool.mcpServerId}
                  </div>
                )}
                {result.tool.category && (
                  <div className="flex items-center gap-1 text-gray-500 bg-gray-900/50 px-2 py-1 rounded">
                    <Tag size={10} />
                    {result.tool.category}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {results.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-12">
              No tools found matching your criteria
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
