'use client';

import { useState, useEffect } from 'react';
import { Folder, GitBranch, Box, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ProjectDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/project/structure')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return <div className="p-8 text-white">Loading project structure...</div>;

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/">
          <Button variant="ghost" className="text-white/60 hover:text-white pl-0">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8 text-white">Project Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Submodules */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <GitBranch className="text-blue-400" />
              Submodules
            </h2>
            <div className="space-y-3">
              {data.submodules.map((sub: any) => (
                <div key={sub.path} className="bg-gray-800 p-3 rounded border border-gray-700 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-200">{sub.path}</div>
                    <div className="text-xs text-gray-500 font-mono">{sub.commit}</div>
                  </div>
                  <div className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                    {sub.version}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Structure */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Folder className="text-yellow-400" />
              Directory Structure
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Packages</h3>
                <div className="flex flex-wrap gap-2">
                  {data.structure.packages.map((pkg: string) => (
                    <span key={pkg} className="bg-gray-800 border border-gray-700 px-3 py-1 rounded text-sm flex items-center gap-2 text-gray-200">
                      <Box size={14} /> {pkg}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Config Files</h3>
                <div className="flex flex-wrap gap-2">
                  {data.structure.config.map((cfg: string) => (
                    <span key={cfg} className="bg-gray-800 border border-gray-700 px-3 py-1 rounded text-sm font-mono text-gray-300">
                      {cfg}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
