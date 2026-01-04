
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash, RefreshCw, Folder, GitBranch, GitCommit, Play, Square, Terminal } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LocalSession {
  id: string;
  path: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastCheck: number;
  branch?: string;
  commit?: string;
  remote?: string;
  logs?: string[];
}

export function CouncilDashboard() {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewLogsId, setViewLogsId] = useState<string | null>(null);
  const [activeLogs, setActiveLogs] = useState<string[]>([]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:3002/api/council/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  };

  const fetchLogs = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3002/api/council/sessions/${id}/logs`);
      const data = await res.json();
      setActiveLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    }
  };

  const addSession = async () => {
    if (!newPath) return;
    try {
      setIsLoading(true);
      await fetch('http://localhost:3002/api/council/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath })
      });
      setNewPath("");
      setIsDialogOpen(false);
      fetchSessions();
    } catch (err) {
      console.error("Failed to add session", err);
    } finally {
      setIsLoading(false);
    }
  };

  const removeSession = async (id: string) => {
    try {
      await fetch(`http://localhost:3002/api/council/sessions/${id}`, {
        method: 'DELETE'
      });
      fetchSessions();
    } catch (err) {
      console.error("Failed to remove session", err);
    }
  };

  const refreshSession = async (id: string) => {
    try {
      await fetch(`http://localhost:3002/api/council/sessions/${id}/refresh`, {
        method: 'POST'
      });
      fetchSessions();
    } catch (err) {
      console.error("Failed to refresh session", err);
    }
  };

  const startSession = async (id: string) => {
    try {
      await fetch(`http://localhost:3002/api/council/sessions/${id}/start`, {
        method: 'POST'
      });
      fetchSessions();
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  const stopSession = async (id: string) => {
    try {
      await fetch(`http://localhost:3002/api/council/sessions/${id}/stop`, {
        method: 'POST'
      });
      fetchSessions();
    } catch (err) {
      console.error("Failed to stop session", err);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
        fetchSessions();
        if (viewLogsId) fetchLogs(viewLogsId);
    }, 2000); // Poll faster for responsiveness
    return () => clearInterval(interval);
  }, [viewLogsId]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest">Autopilot Council</h2>
            <p className="text-sm text-white/60">Manage local OpenCode sessions and transient repositories.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-500 text-white font-mono uppercase tracking-widest text-xs">
                <Plus className="mr-2 h-4 w-4" />
                Add Local Repo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Add Local Repository</DialogTitle>
                <DialogDescription className="text-white/60">
                  Enter the absolute path to the local directory you want the Council to monitor.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="path" className="text-right text-white/80">
                    Path
                  </Label>
                  <Input
                    id="path"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="/path/to/project"
                    className="col-span-3 bg-zinc-800 border-white/10 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-white hover:bg-white/10">Cancel</Button>
                <Button onClick={addSession} disabled={isLoading || !newPath} className="bg-purple-600 hover:bg-purple-500 text-white">
                  Add Repository
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/10 rounded-lg bg-zinc-900/50">
            <Folder className="h-12 w-12 text-white/20 mb-4" />
            <p className="text-white/40 font-mono text-sm">No local repositories connected.</p>
            <p className="text-white/20 text-xs mt-1">Click "Add Local Repo" to start.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Card key={session.id} className="bg-zinc-900 border-white/10 hover:border-purple-500/30 transition-colors group relative overflow-hidden flex flex-col">
                 {/* Status Indicator Bar */}
                 <div className={`absolute top-0 left-0 w-1 h-full ${
                   session.status === 'running' ? 'bg-green-500' : 
                   session.status === 'starting' ? 'bg-yellow-500' : 
                   session.status === 'error' ? 'bg-red-500' : 'bg-zinc-700'
                 }`} />

                <CardHeader className="pb-2 pl-6">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-white text-base truncate pr-2" title={session.name}>
                      {session.name}
                    </CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white" onClick={() => refreshSession(session.id)}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-red-400" onClick={() => removeSession(session.id)}>
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-white/40 text-xs font-mono truncate" title={session.path}>
                    {session.path}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-6 pt-2 space-y-3 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                     <div className={`h-2 w-2 rounded-full ${
                        session.status === 'running' ? 'bg-green-500 animate-pulse' : 
                        session.status === 'starting' ? 'bg-yellow-500 animate-pulse' :
                        session.status === 'error' ? 'bg-red-500' : 'bg-zinc-600'
                     }`} />
                     <span className="text-white/60 font-mono uppercase">{session.status}</span>
                  </div>

                  <div className="space-y-1">
                    {session.branch && (
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-mono truncate">{session.branch}</span>
                      </div>
                    )}
                    {session.commit && (
                      <div className="flex items-center gap-2 text-xs text-white/30">
                        <GitCommit className="h-3 w-3" />
                        <span className="font-mono truncate">{session.commit.substring(0, 7)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                
                <div className="p-4 border-t border-white/5 flex gap-2">
                   {session.status === 'running' || session.status === 'starting' ? (
                       <Button 
                        size="sm" 
                        variant="destructive" 
                        className="w-full text-xs font-mono"
                        onClick={() => stopSession(session.id)}
                       >
                         <Square className="h-3 w-3 mr-2 fill-current" /> Stop
                       </Button>
                   ) : (
                       <Button 
                        size="sm" 
                        className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-mono"
                        onClick={() => startSession(session.id)}
                       >
                         <Play className="h-3 w-3 mr-2 fill-current" /> Start
                       </Button>
                   )}
                   
                   <Dialog>
                       <DialogTrigger asChild>
                           <Button 
                             size="sm" 
                             variant="secondary" 
                             className="bg-zinc-800 text-white/60 hover:text-white"
                             onClick={() => setViewLogsId(session.id)}
                           >
                               <Terminal className="h-3 w-3" />
                           </Button>
                       </DialogTrigger>
                       <DialogContent className="max-w-3xl h-[80vh] bg-zinc-950 border-white/10 text-white flex flex-col p-0 gap-0">
                           <DialogHeader className="p-6 border-b border-white/10 bg-zinc-900">
                               <DialogTitle className="flex items-center gap-2">
                                   <Terminal className="h-4 w-4 text-purple-400" />
                                   Console Output: {session.name}
                               </DialogTitle>
                           </DialogHeader>
                           <ScrollArea className="flex-1 p-6 font-mono text-xs">
                               <div className="space-y-1">
                                   {activeLogs.length > 0 ? (
                                       activeLogs.map((log, i) => (
                                           <div key={i} className={`
                                               break-all whitespace-pre-wrap
                                               ${log.includes('[Error]') || log.includes('ERR]') ? 'text-red-400' : 'text-white/80'}
                                               ${log.includes('[System]') ? 'text-blue-400' : ''}
                                               ${log.includes('[Council]') ? 'text-purple-400' : ''}
                                           `}>
                                               {log}
                                           </div>
                                       ))
                                   ) : (
                                       <div className="text-white/30 italic">No logs available...</div>
                                   )}
                               </div>
                           </ScrollArea>
                       </DialogContent>
                   </Dialog>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
