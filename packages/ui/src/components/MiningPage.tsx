'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cpu, HardDrive, Activity, Wallet, Play, Square, Usb, RefreshCw, Zap, Heart, Footprints } from 'lucide-react';
import { toast } from "sonner";

interface ActivityData {
  totalSteps: number;
  avgHeartRate: number;
  totalDanceScore: number;
}

interface SystemSpecs {
  cpu: { manufacturer: string; brand: string; speed: number; cores: number };
  memory: { total: number; free: number; used: number };
  gpu: Array<{ vendor: string; model: string; vram: number }>;
  wearables: string[];
  serialPortAvailable: boolean;
}

interface EconomyBalance {
  address: string;
  balance: number;
  currency: string;
  externalWallet: string | null;
}

export default function MiningPage() {
  const [miningActive, setMiningActive] = useState(false);
  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [connectedPort, setConnectedPort] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityData>({ totalSteps: 0, avgHeartRate: 0, totalDanceScore: 0 });
  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs | null>(null);
  const [balance, setBalance] = useState<EconomyBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPorts = useCallback(async () => {
    try {
      const res = await fetch('/api/hardware/ports');
      const data = await res.json();
      setPorts(data.ports || []);
    } catch (error) {
      console.error('Failed to fetch ports', error);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/hardware/activity');
      const data = await res.json();
      setActivity(data);
    } catch (error) {
      console.error('Failed to fetch activity', error);
    }
  }, []);

  const fetchSystemSpecs = useCallback(async () => {
    try {
      const res = await fetch('/api/hardware/system');
      const data = await res.json();
      setSystemSpecs(data);
    } catch (error) {
      console.error('Failed to fetch system specs', error);
    }
  }, []);

  const fetchMiningStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mining/status');
      const data = await res.json();
      setMiningActive(data);
    } catch (error) {
      console.error('Failed to fetch mining status', error);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/economy/balance');
      const data = await res.json();
      setBalance(data);
    } catch (error) {
      console.error('Failed to fetch balance', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPorts(), fetchSystemSpecs(), fetchMiningStatus(), fetchBalance(), fetchActivity()]);
      setLoading(false);
    };
    init();
  }, [fetchPorts, fetchSystemSpecs, fetchMiningStatus, fetchBalance, fetchActivity]);

  useEffect(() => {
    if (!miningActive) return;
    const interval = setInterval(() => {
      fetchActivity();
      fetchBalance();
    }, 5000);
    return () => clearInterval(interval);
  }, [miningActive, fetchActivity, fetchBalance]);

  const handleConnect = async () => {
    if (!selectedPort) {
      toast.error('Select a port first');
      return;
    }
    try {
      const res = await fetch('/api/hardware/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPort, baudRate: 9600 }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectedPort(selectedPort);
        toast.success(`Connected to ${selectedPort}`);
      } else {
        toast.error('Failed to connect');
      }
    } catch (error) {
      toast.error('Connection error');
    }
  };

  const handleDisconnect = async () => {
    if (!connectedPort) return;
    try {
      await fetch('/api/hardware/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: connectedPort }),
      });
      setConnectedPort(null);
      toast.success('Disconnected');
    } catch (error) {
      toast.error('Disconnect error');
    }
  };

  const handleStartMining = async () => {
    try {
      await fetch('/api/mining/start', { method: 'POST' });
      setMiningActive(true);
      toast.success('Mining started');
    } catch (error) {
      toast.error('Failed to start mining');
    }
  };

  const handleStopMining = async () => {
    try {
      await fetch('/api/mining/stop', { method: 'POST' });
      setMiningActive(false);
      toast.success('Mining stopped');
    } catch (error) {
      toast.error('Failed to stop mining');
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bobcoin Mining</h1>
          <p className="text-muted-foreground">Proof of Dance consensus - mine with movement</p>
        </div>
        <Badge variant={miningActive ? "default" : "secondary"} className="text-lg px-4 py-2">
          {miningActive ? <><Zap className="h-4 w-4 mr-2 inline" />Mining Active</> : 'Mining Inactive'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mining Control</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {miningActive ? (
                <Button variant="destructive" onClick={handleStopMining} className="flex-1">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Mining
                </Button>
              ) : (
                <Button onClick={handleStartMining} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Start Mining
                </Button>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {miningActive ? 'Earning Bobcoin from your activity...' : 'Connect a wearable and start mining to earn Bobcoin'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wearable Connection</CardTitle>
            <Usb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedPort} onValueChange={setSelectedPort} disabled={!!connectedPort}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select port" />
                </SelectTrigger>
                <SelectContent>
                  {ports.length === 0 ? (
                    <SelectItem value="none" disabled>No ports found</SelectItem>
                  ) : (
                    ports.map((port) => (
                      <SelectItem key={port} value={port}>{port}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={fetchPorts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {connectedPort ? (
              <Button variant="outline" onClick={handleDisconnect} className="w-full">
                Disconnect {connectedPort}
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleConnect} className="w-full" disabled={!selectedPort}>
                Connect Device
              </Button>
            )}
            <div className="text-sm text-muted-foreground">
              {systemSpecs?.serialPortAvailable ? 'Serial port support available' : 'Serial port not available - using simulation'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bobcoin Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {balance?.balance.toLocaleString() ?? 0} <span className="text-lg font-normal text-muted-foreground">{balance?.currency ?? 'BOB'}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-2 truncate">
              {balance?.address ? `Wallet: ${balance.address.slice(0, 10)}...` : 'No wallet connected'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Stats</CardTitle>
            <Footprints className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{activity.totalSteps.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Steps</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{activity.totalDanceScore.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">Dance Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Heart className="h-4 w-4 text-red-500" />
                  {activity.avgHeartRate.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Avg BPM</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Specs</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {systemSpecs ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium">CPU</div>
                  <div className="text-sm text-muted-foreground">{systemSpecs.cpu.brand}</div>
                  <div className="text-xs text-muted-foreground">{systemSpecs.cpu.cores} cores @ {systemSpecs.cpu.speed} GHz</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Memory</div>
                  <div className="text-sm text-muted-foreground">{formatBytes(systemSpecs.memory.used)} / {formatBytes(systemSpecs.memory.total)}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(systemSpecs.memory.free)} free</div>
                </div>
                <div>
                  <div className="text-sm font-medium">GPU</div>
                  {systemSpecs.gpu.length > 0 ? (
                    systemSpecs.gpu.map((g, i) => (
                      <div key={i} className="text-sm text-muted-foreground">{g.model}</div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No GPU detected</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">Loading system specs...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
