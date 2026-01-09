"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import EcosystemList from './EcosystemList';
import { Submodule, SubmoduleData } from '@/types/submodule';

export default function EcosystemDashboard() {
  const [data, setData] = useState<SubmoduleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/submodules.json')
      .then(res => res.json())
      .then((data: SubmoduleData) => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch submodules:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading ecosystem data...</div>;
  }

  const submodules = data?.submodules || [];
  const installedCount = submodules.filter(s => s.isInstalled).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ecosystem Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of integrated submodules, references, and their operational status.
          </p>
        </div>
        <div className="flex gap-2">
           {submodules.length > 0 && (
             <Badge variant="outline" className="text-lg py-1 px-3 bg-green-950/30 text-green-400 border-green-800 flex items-center gap-1">
               <CheckCircle2 className="h-4 w-4" /> Index Synced
             </Badge>
           )}
           <Badge variant="outline" className="text-lg py-1 px-3">
             {submodules.length} Modules
           </Badge>
           <Badge variant="secondary" className="text-lg py-1 px-3">
             {installedCount} Installed
           </Badge>
        </div>
      </div>

      <EcosystemList initialSubmodules={submodules} />
    </div>
  );
}

