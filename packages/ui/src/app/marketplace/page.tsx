'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Download } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
const API_BASE = 'http://localhost:3000';

export default function Marketplace() {
  const [packages, setPackages] = useState<any[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    socket.on('state', (data: any) => {
      if (data.marketplace) setPackages(data.marketplace);
    });
    socket.on('marketplace_updated', (data: any) => setPackages(data));

    // Trigger refresh on load
    fetch(`${API_BASE}/api/marketplace/refresh`, { method: 'POST' });

    return () => {
      socket.off('state');
      socket.off('marketplace_updated');
    };
  }, []);

  const install = async (name: string) => {
    setInstalling(name);
    try {
      await fetch(`${API_BASE}/api/marketplace/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      alert(`Installed ${name}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Plugin Marketplace</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div key={pkg.name} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
                  <ShoppingBag size={24} />
                </div>
                <span className="text-xs font-mono bg-gray-700 px-2 py-1 rounded text-gray-300">{pkg.type}</span>
              </div>
              <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
              <p className="text-gray-400 text-sm">{pkg.description}</p>
            </div>
            <div className="p-4 bg-gray-750 border-t border-gray-700">
              <button
                onClick={() => install(pkg.name)}
                disabled={!!installing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {installing === pkg.name ? <span className="animate-spin">⏳</span> : <Download size={18} />}
                Install
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
