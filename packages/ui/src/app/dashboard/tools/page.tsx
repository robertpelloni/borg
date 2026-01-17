'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, RefreshCw, CheckCircle } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import Link from 'next/link';

interface Resource {
  id: string;
  url: string;
  normalized_url?: string;
  name?: string;
  category: string;
  categories?: string[];
  path?: string;
  source?: string;
  kind?: string;
  submodule?: boolean;
  researched: boolean;
  summary: string;
  features: string[];
  tags?: string[];
  last_updated: string;
  // New fields for dashboard
  installed?: boolean;
  authType?: 'api_key' | 'oauth' | 'none';
  usage?: number;
  budget?: number;
}

export default function AI_Tools_Dashboard() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/resources');
      const data = await res.json();
      
      // Enrich with mock status data for now
      const enriched = (data.resources || []).map((r: Resource) => ({
        ...r,
        installed: Math.random() > 0.7, // Mock detection
        authType: Math.random() > 0.5 ? 'api_key' : 'oauth',
        usage: Math.floor(Math.random() * 100),
        budget: 1000
      }));
      
      setResources(enriched);
    } catch (e) {
      console.error("Failed to fetch resources", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const categories = ['All', ...Array.from(new Set(resources.map(r => r.category).filter(Boolean)))];

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.url.toLowerCase().includes(search.toLowerCase()) || 
                          (resource.path || '').toLowerCase().includes(search.toLowerCase()) ||
                          (resource.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (resource.summary || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || resource.category === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Tools & Integration</h1>
        <Button onClick={fetchResources} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Manage external tools, MCP servers, and submodules ({resources.length} indexed).</p>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tools..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select 
          className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-ring w-full md:w-48"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tool Index</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-2">Tool Name / URL</th>
                    <th className="text-left py-3 px-2">Category</th>
                    <th className="text-left py-3 px-2">Install Status</th>
                    <th className="text-left py-3 px-2">Auth</th>
                    <th className="text-left py-3 px-2">Usage / Budget</th>
                    <th className="text-left py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map((resource, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="py-3 px-2">
                        <div className="font-medium flex items-center gap-2">
                            {resource.name || resource.path?.split('/').pop() || resource.url}
                            {resource.submodule && <Badge variant="outline" className="text-[10px] h-4">Submodule</Badge>}
                        </div>
                        <a href={resource.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline truncate max-w-[300px] block">
                          {resource.url}
                        </a>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary">{resource.category}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        {resource.installed ? (
                          <span className="text-green-500 flex items-center gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Installed</span>
                        ) : (
                          <span className="text-gray-500 flex items-center gap-1 text-xs">Not Installed</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">
                            {resource.authType === 'oauth' ? 'OAuth' : 'API Key'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs">
                            <span className="font-mono">${resource.usage}</span> / <span className="text-muted-foreground">${resource.budget}</span>
                            <Progress value={(resource.usage! / resource.budget!) * 100} className="h-1 mt-1 w-24" />
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/tools/${resource.id}`}>Details</Link>
                            </Button>
                            {!resource.installed && (
                                <Button variant="secondary" size="sm" className="h-7 text-xs">Install</Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredResources.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No resources found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
