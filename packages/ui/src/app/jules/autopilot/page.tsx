'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Radio, Terminal, Play, Pause, AlertTriangle } from 'lucide-react';

export default function JulesAutopilotPage() {
  const [autoAccept, setAutoAccept] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [logs, setLogs] = useState<string[]>([
    '[System] Jules Keeper initialized.',
    '[Jules] Connecting to cloud environment...',
    '[Jules] Connected. Waiting for sessions...'
  ]);

  const handleBroadcast = () => {
    if (!broadcastMsg) return;
    setLogs(prev => [...prev, `[Broadcast] Sending to all sessions: "${broadcastMsg}"`]);
    setBroadcastMsg('');
  };

  const handleForceSend = () => {
      if (!broadcastMsg) return;
      setLogs(prev => [...prev, `[Force Send] Sending to FAILED/COMPLETED sessions: "${broadcastMsg}"`]);
      setBroadcastMsg('');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Jules Autopilot Dashboard</h1>
            <p className="text-muted-foreground">Manage your Google Jules Cloud Development Environment.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 border p-2 rounded-lg bg-card">
                <Switch id="auto-accept" checked={autoAccept} onCheckedChange={setAutoAccept} />
                <Label htmlFor="auto-accept">Auto-Accept Plans</Label>
            </div>
            <Button variant="outline">
                <Terminal className="mr-2 h-4 w-4" /> View Console
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/10">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        <div>
                            <h3 className="font-medium">Session #1249</h3>
                            <p className="text-xs text-muted-foreground">Task: Refactor auth middleware</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Running</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/10">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div>
                            <h3 className="font-medium">Session #1250</h3>
                            <p className="text-xs text-muted-foreground">Task: Update dependencies</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Waiting for Approval</Badge>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Broadcast Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label>Broadcast Message</Label>
                <div className="flex gap-2">
                    <Input 
                        value={broadcastMsg} 
                        onChange={(e) => setBroadcastMsg(e.target.value)} 
                        placeholder="Message all sessions..." 
                    />
                    <Button size="icon" onClick={handleBroadcast}>
                        <Radio className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">Sends to all active sessions.</p>
             </div>

             <div className="pt-4 border-t">
                <Button variant="destructive" className="w-full" onClick={handleForceSend}>
                    <AlertTriangle className="mr-2 h-4 w-4" /> Force Send (All States)
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                    Forces message to failed/completed sessions.
                </p>
             </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" /> System Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 rounded-md border bg-black p-4">
                {logs.map((log, i) => (
                    <div key={i} className="font-mono text-xs text-green-400 mb-1">
                        <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                    </div>
                ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
