'use client';

import { useState, useEffect } from 'react';
import { getCouncilConfig, saveCouncilConfig } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

interface Member {
    name: string;
    provider: string;
    modelId: string;
    systemPrompt: string;
}

export default function CouncilPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const config = await getCouncilConfig();
        if (config && config.members) {
            setMembers(config.members);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        await saveCouncilConfig({ members });
        setSaving(false);
        alert("Council Configuration Saved!");
    };

    const addMember = () => {
        setMembers([...members, { name: "New Member", provider: "lmstudio", modelId: "local", systemPrompt: "You are a helpful assistant." }]);
    };

    const removeMember = (index: number) => {
        const newMembers = [...members];
        newMembers.splice(index, 1);
        setMembers(newMembers);
    };

    const updateMember = (index: number, field: keyof Member, value: string) => {
        const newMembers = [...members];
        newMembers[index] = { ...newMembers[index], [field]: value };
        setMembers(newMembers);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Council...</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                        Council Chamber
                    </h1>
                    <p className="text-gray-400">Configure the AI personas that guide the Director.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Configuration
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {members.map((member, idx) => (
                    <Card key={idx} className="bg-[#1e1e1e] border-[#333]">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
                                <Input
                                    value={member.name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMember(idx, 'name', e.target.value)}
                                    className="bg-transparent border-none text-lg font-bold w-48 focus:ring-0 text-purple-400 p-0"
                                />
                                <span className="text-xs text-gray-500 font-normal">({member.provider})</span>
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => removeMember(idx)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Provider</label>
                                    <select
                                        value={member.provider}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMember(idx, 'provider', e.target.value)}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-white"
                                    >
                                        <option value="ollama">Ollama (Local)</option>
                                        <option value="lmstudio">LM Studio (Local)</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="google">Google Gemini</option>
                                        <option value="anthropic">Anthropic Claude</option>
                                        <option value="deepseek">DeepSeek</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Model ID</label>
                                    <Input
                                        value={member.modelId}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMember(idx, 'modelId', e.target.value)}
                                        className="bg-[#111] border-[#333] text-white"
                                        placeholder="e.g. gemma:2b, gpt-4o"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">System Persona</label>
                                <textarea
                                    value={member.systemPrompt}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateMember(idx, 'systemPrompt', e.target.value)}
                                    className="w-full h-24 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-gray-300 resize-none font-mono"
                                    placeholder="You represent..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}

                <Button variant="outline" onClick={addMember} className="border-dashed border-gray-600 text-gray-400 hover:bg-[#222]">
                    <Plus className="mr-2 h-4 w-4" /> Add Council Member
                </Button>
            </div>
        </div>
    );
}
