'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, Search, Filter, GitBranch } from 'lucide-react';
import type { Submodule, SyncStatus } from '@/types/submodule';
import { useSubmoduleHealth, getHealthColor } from '@/hooks/useSubmoduleHealth';

interface EcosystemListProps {
  initialSubmodules: Submodule[];
}

export default function EcosystemList({ initialSubmodules }: EcosystemListProps) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const { getHealth } = useSubmoduleHealth(initialSubmodules.map(s => s.name));

  const categories = ['All', ...Array.from(new Set(initialSubmodules.map(s => s.category).filter(Boolean)))];

  const filteredSubmodules = initialSubmodules.filter(module => {
    const matchesStatus = 
      filter === 'All' ? true :
      filter === 'Active' ? module.isInstalled :
      filter === 'Reference' ? !module.isInstalled : true;

    const matchesCategory = 
      categoryFilter === 'All' ? true : 
      module.category === categoryFilter;

    const matchesSearch = 
      search === '' ? true :
      module.name.toLowerCase().includes(search.toLowerCase()) ||
      module.description.toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-gray-900/30 p-4 rounded-lg border border-gray-800">
        <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search modules..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <div className="flex gap-2">
            {['All', 'Active', 'Reference'].map(status => (
              <Button 
                key={status}
                variant={filter === status ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              className="bg-background border border-input rounded-md px-3 py-1 text-sm focus:ring-1 focus:ring-ring"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSubmodules.map((module, index) => (
          <Card key={index} className="flex flex-col h-full border-gray-800 bg-gray-950/50 hover:bg-gray-900/50 transition-colors">
<CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl text-blue-400 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${getHealthColor(getHealth(module.name).status)}`} title={`Health: ${getHealth(module.name).status}`} />
                  {module.name}
                  {module.isInstalled ? (
                    <span title="Installed & Valid">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </span>
                  ) : (
                    <span title="Reference Only / Not Found">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </span>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  {module.syncStatus && (
                    <Badge 
                      variant="outline" 
                      className={
                        module.syncStatus === 'synced' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        module.syncStatus === 'behind' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        module.syncStatus === 'ahead' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        module.syncStatus === 'diverged' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }
                    >
                      <GitBranch className="h-3 w-3 mr-1" />
                      {module.syncStatus}
                    </Badge>
                  )}
                  <Badge variant={module.isInstalled ? "default" : "secondary"}>
                    {module.isInstalled ? "Active" : "Reference"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">{module.category}</Badge>
                <Badge variant="outline" className="text-xs">{module.role}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-gray-300 mb-4 line-clamp-3" title={module.description}>
                {module.description}
              </p>
              
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Rationale</span>
                  <p className="text-xs text-gray-400 line-clamp-2">{module.rationale}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-gray-800 flex flex-col gap-2 items-stretch">
              {(module.date || module.commit) && (
                <div className="flex justify-between w-full text-xs text-muted-foreground mb-1">
                  {module.date && (
                    <span className="flex items-center gap-1" title={module.date}>
                      <span>📅</span> {new Date(module.date).toLocaleDateString()}
                    </span>
                  )}
                  {module.commit && (
                    <span className="flex items-center gap-1" title={`Commit: ${module.commit}`}>
                      <span>#</span> <code className="bg-gray-900 px-1 rounded font-mono text-[10px]">{module.commit.substring(0, 7)}</code>
                    </span>
                  )}
                </div>
              )}
              <div className="flex justify-between w-full items-center">
                 <code className="text-xs bg-gray-900 px-2 py-1 rounded text-gray-500 truncate max-w-[150px]" title={module.path}>
                   {module.path}
                 </code>
                 <Button variant="ghost" size="sm" asChild>
                   <Link href={`/dashboard/ecosystem/${module.name}`}>Details &rarr;</Link>
                 </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
        
        {filteredSubmodules.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No modules found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
