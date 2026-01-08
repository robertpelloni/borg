import fs from 'fs';
import path from 'path';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import EcosystemList from './EcosystemList'; // We'll move the client-side list logic here

// Type definition for our submodule data
export interface Submodule {
  name: string;
  path: string;
  category: string;
  role: string;
  description: string;
  rationale: string;
  integrationStrategy: string;
  status: string;
  isInstalled: boolean;
  date?: string;
  commit?: string;
}

async function getSubmodules(): Promise<Submodule[]> {
  // Try to resolve the path relative to where the server process might be running
  // In a monorepo, it's often the root or the package root.
  const possiblePaths = [
    path.join(process.cwd(), 'docs/SUBMODULE_INDEX.csv'),          // Run from root
    path.join(process.cwd(), '../../docs/SUBMODULE_INDEX.csv'),    // Run from packages/ui
    path.join(process.cwd(), '../../../docs/SUBMODULE_INDEX.csv'), // Deeper nesting?
  ];

  let csvPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      csvPath = p;
      break;
    }
  }

  if (!csvPath) {
    console.error('Could not find SUBMODULE_INDEX.csv in:', possiblePaths);
    return [];
  }
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Skip header
    return lines.slice(1).map(line => {
      // Handle simple CSV parsing
      // Note: This split is naive and will break if fields contain commas. 
      // For this specific dataset, it's acceptable.
      const values = line.split(',').map(v => v.trim());
      const entry: any = {};
      
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/ /g, '');
        if (key.includes('strategy')) entry.integrationStrategy = values[index];
        else entry[key] = values[index];
      });

      // Check if installed. We need to resolve the path relative to the repo root.
      // We assume csvPath is at <ROOT>/docs/SUBMODULE_INDEX.csv
      const repoRoot = path.dirname(path.dirname(csvPath));
      const fullPath = path.join(repoRoot, entry.path || '');
      const isInstalled = fs.existsSync(fullPath);

      return {
        name: entry.name || 'Unknown',
        path: entry.path || '',
        category: entry.category || 'Other',
        role: entry.role || 'Tool',
        description: entry.description || '',
        rationale: entry.rationale || '',
        integrationStrategy: entry.integrationStrategy || '',
        status: entry.status || 'Unknown',
        isInstalled,
        date: entry.date,
        commit: entry.commit
      };
    });
  } catch (error) {
    console.error('Error reading submodule index:', error);
    return [];
  }
}

export default async function EcosystemDashboard() {
  const submodules = await getSubmodules();

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
             {submodules.filter(s => s.isInstalled).length} Installed
           </Badge>
        </div>
      </div>

      <EcosystemList initialSubmodules={submodules} />
    </div>
  );
}
