import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Trash2, Plus, Save } from 'lucide-react';

interface Secret {
  key: string;
  value: string;
  lastModified: number;
}

const API_BASE = 'http://localhost:3000';

export const Secrets = () => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSecrets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/secrets`);
      const data = await res.json();
      setSecrets(data.secrets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newValue) return;

    await fetch(`${API_BASE}/api/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey, value: newValue })
    });

    setNewKey('');
    setNewValue('');
    fetchSecrets();
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`${API_BASE}/api/secrets/${key}`, { method: 'DELETE' });
    fetchSecrets();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">API Keys & Secrets</h1>

      {/* Add New Secret */}
      <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Plus className="text-blue-400" /> Add New Secret
        </h2>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Key Name (e.g. OPENAI_API_KEY)</label>
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="MY_SECRET_KEY"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Value</label>
            <input
              type="password"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="sk-..."
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium transition-colors flex items-center gap-2"
          >
            <Save size={18} /> Save
          </button>
        </form>
      </div>

      {/* List Secrets */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="grid grid-cols-12 bg-gray-750 p-4 border-b border-gray-700 font-medium text-gray-400">
          <div className="col-span-4">Key</div>
          <div className="col-span-6">Value</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading secrets...</div>
        ) : secrets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No secrets found. Add one above.</div>
        ) : (
          secrets.map(secret => (
            <div key={secret.key} className="grid grid-cols-12 p-4 border-b border-gray-700 last:border-0 hover:bg-gray-750 items-center">
              <div className="col-span-4 font-mono text-yellow-400">{secret.key}</div>
              <div className="col-span-6 font-mono text-gray-500">
                {secret.value}
              </div>
              <div className="col-span-2 text-right">
                <button
                  onClick={() => handleDelete(secret.key)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
