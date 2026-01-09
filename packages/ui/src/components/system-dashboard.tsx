'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderTree, GitBranch, Clock, Hash, Server, Layout, Box } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface SubmoduleInfo {
  name: string;
  path: string;
  commit: string;
  branch: string;
  date: string;
  status: string;
}

interface StructureInfo {
  path: string;
  description: string;
}

interface SystemInfo {
  submodules: SubmoduleInfo[];
  structure: StructureInfo[];
  rootVersion: string;
}

export function SystemDashboard() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch system info');
        return res.json();
      })
      .then(data => setInfo(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-white/40">Loading system information...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>;
  if (!info) return null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
          <p className="text-white/40">Project structure and submodule status</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1 border-white/20">
          v{info.rootVersion}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Submodules Card */}
        <Card className="bg-zinc-900 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-purple-400" />
              Submodules
            </CardTitle>
            <CardDescription className="text-white/40">
              Current state of linked Git modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {info.submodules.map((sub) => (
                  <div key={sub.path} className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-white/40" />
                        {sub.name}
                      </div>
                      <Badge className={`${
                        sub.status === 'Clean' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      } border-0`}>
                        {sub.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-mono text-white/60 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3" />
                        <span className="text-white/40">Commit:</span>
                        <span className="text-purple-300">{sub.commit.substring(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        <span className="text-white/40">Branch:</span>
                        <span>{sub.branch}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span className="text-white/40">Date:</span>
                        <span>{sub.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Layout className="h-3 w-3" />
                        <span className="text-white/40">Path:</span>
                        <span className="break-all">{sub.path}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Project Structure Card */}
        <Card className="bg-zinc-900 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-blue-400" />
              Project Structure
            </CardTitle>
            <CardDescription className="text-white/40">
              Directory layout and component responsibilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-1">
                {info.structure.map((item, i) => (
                  <div key={item.path} className="relative pl-6 pb-6 last:pb-0">
                    {/* Tree Line */}
                    {i !== info.structure.length - 1 && (
                      <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/10" />
                    )}
                    <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-white/20" />
                    
                    <div className="space-y-1">
                      <div className="font-mono text-sm font-bold text-blue-300">
                        {item.path}
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
