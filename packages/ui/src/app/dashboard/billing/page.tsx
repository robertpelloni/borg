'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Key, ExternalLink, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface ProviderStatus {
  name: string;
  balance?: number;
  currency?: string;
  usage?: number;
  limit?: number;
  status: 'active' | 'inactive' | 'error';
  type: 'api_key' | 'oauth';
  subscription?: string;
}

export default function BillingPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([
    { name: 'OpenAI', balance: 12.45, currency: 'USD', usage: 45.50, limit: 100, status: 'active', type: 'api_key', subscription: 'Tier 4' },
    { name: 'Anthropic', balance: 45.00, currency: 'USD', usage: 5.00, limit: 50, status: 'active', type: 'api_key', subscription: 'Build Tier' },
    { name: 'Google Vertex', balance: 0, currency: 'USD', usage: 0, limit: 0, status: 'active', type: 'oauth', subscription: 'Free Tier' },
    { name: 'OpenRouter', balance: 2.15, currency: 'USD', usage: 1.20, limit: 10, status: 'active', type: 'api_key' },
    { name: 'Azure OpenAI', status: 'inactive', type: 'api_key' },
    { name: 'Mistral', status: 'inactive', type: 'api_key' },
    { name: 'Groq', status: 'inactive', type: 'api_key' },
  ]);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const refreshStatus = () => {
    setTimeout(() => {
    }, 500);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <CreditCard className="h-8 w-8" /> Usage & Billing
            </h1>
            <p className="text-muted-foreground">Manage API keys, track usage, and monitor subscriptions across all AI providers.</p>
        </div>
        <Button onClick={refreshStatus} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.filter(p => p.status === 'active').map((provider) => (
                    <Card key={provider.name} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{provider.name}</CardTitle>
                                <Badge variant={provider.type === 'oauth' ? 'secondary' : 'outline'}>
                                    {provider.type === 'oauth' ? 'OAuth' : 'API Key'}
                                </Badge>
                            </div>
                            <CardDescription>{provider.subscription || 'Pay-as-you-go'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">Balance</span>
                                        <span className="font-bold font-mono">${provider.balance?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">Usage (Month)</span>
                                        <span className="font-mono">${provider.usage?.toFixed(2)}</span>
                                    </div>
                                </div>
                                
                                {provider.limit && provider.limit > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span>Quota Used</span>
                                            <span>{Math.round((provider.usage! / provider.limit) * 100)}%</span>
                                        </div>
                                        <Progress value={(provider.usage! / provider.limit) * 100} className="h-2" />
                                        <p className="text-xs text-muted-foreground text-right">Limit: ${provider.limit}</p>
                                    </div>
                                )}
                                
                                <div className="pt-2 border-t flex justify-between items-center">
                                    <span className="text-xs text-green-500 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Operational
                                    </span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                                        <a href="#" target="_blank">Manage <ExternalLink className="ml-1 h-3 w-3" /></a>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>API Key Management</CardTitle>
                    <CardDescription>Securely manage API keys for all providers. Keys are stored locally in .env or encrypted storage.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {providers.map((provider) => (
                            <div key={provider.name} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-full">
                                        <Key className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium">{provider.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {provider.status === 'active' ? '● Configured' : '○ Not Configured'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        type="password" 
                                        placeholder="sk-..." 
                                        className="w-64 font-mono text-xs"
                                        value={apiKeys[provider.name] || ''}
                                        onChange={(e) => setApiKeys({...apiKeys, [provider.name]: e.target.value})}
                                    />
                                    <Button size="sm">Save</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Pro Subscriptions</CardTitle>
                        <CardDescription>Direct links to manage your pro accounts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {[
                            { name: 'ChatGPT Plus', url: 'https://chat.openai.com/#pricing' },
                            { name: 'Claude Pro', url: 'https://claude.ai/settings/billing' },
                            { name: 'Gemini Advanced', url: 'https://one.google.com/explore-plan/gemini-advanced' },
                            { name: 'GitHub Copilot', url: 'https://github.com/settings/copilot' },
                            { name: 'Midjourney', url: 'https://www.midjourney.com/account' },
                            { name: 'Perplexity Pro', url: 'https://www.perplexity.ai/settings' }
                        ].map((sub) => (
                            <a key={sub.name} href={sub.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 border rounded hover:bg-accent transition-colors group">
                                <span>{sub.name}</span>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            </a>
                        ))}
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Cloud Credits</CardTitle>
                        <CardDescription>Manage cloud infrastructure credits.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                         {[
                            { name: 'OpenAI Platform', url: 'https://platform.openai.com/account/billing' },
                            { name: 'Anthropic Console', url: 'https://console.anthropic.com/settings/billing' },
                            { name: 'Google Cloud Console', url: 'https://console.cloud.google.com/billing' },
                            { name: 'Azure Portal', url: 'https://portal.azure.com/#view/Microsoft_Azure_Billing/SubscriptionsBlade' },
                            { name: 'OpenRouter Credits', url: 'https://openrouter.ai/credits' },
                            { name: 'Vercel Usage', url: 'https://vercel.com/dashboard/usage' }
                        ].map((sub) => (
                            <a key={sub.name} href={sub.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 border rounded hover:bg-accent transition-colors group">
                                <span>{sub.name}</span>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            </a>
                        ))}
                    </CardContent>
                </Card>
             </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
