'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ContextViewer, CompactedContext } from '@/components/context-viewer';
import { Loader2, ArrowRight } from 'lucide-react';

export default function MemoryInspectorPage() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<CompactedContext | null>(null);

    const handleCompact = async () => {
        if (!input.trim()) return;
        setIsLoading(true);
        setResult(null); // Clear previous result
        
        try {
            const response = await fetch('/api/memory/compact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: input })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to compact context');
            }

            const data = await response.json();
            setResult(data.result);
            
        } catch (e: any) {
            console.error(e);
            // Fallback to error display or toast (omitted for brevity)
            // For now, we'll just show an error state in the result view if possible,
            // or maybe just log it. 
            // Let's create a minimal error result to show something happened
             setResult({
                 summary: `Error: ${e.message}`,
                 facts: [],
                 decisions: [],
                 actionItems: []
             });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Memory Inspector</h1>
                <p className="text-muted-foreground mt-2">
                    Test the Context Compactor logic. Paste raw conversation logs or text below to see how the system extracts structured memory.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Raw Input Content</label>
                        <Button 
                            onClick={handleCompact} 
                            disabled={isLoading || !input.trim()}
                            size="sm"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                            Compact Context
                        </Button>
                    </div>
                    <Textarea 
                        placeholder="Paste conversation or logs here..." 
                        className="h-[400px] font-mono text-xs bg-muted/50 resize-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-sm font-medium">Compacted Memory View</label>
                    {result ? (
                        <ContextViewer context={result} className="h-[400px]" />
                    ) : (
                        <div className="h-[400px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground bg-muted/20">
                            Awaiting output...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
