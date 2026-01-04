'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Upload, Database, CheckCircle2 } from 'lucide-react';

export default function MemoryIngestPage() {
  const [inputText, setInputText] = useState('');
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const handleIngest = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setStatus('processing');
    setSummary('');

    try {
      const response = await fetch('http://localhost:3002/api/memory/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Web UI Ingestion',
          content: inputText,
          tags: ['manual-entry', 'ui']
        })
      });

      const data = await response.json();

      if (data.success) {
        setSummary(data.summary || "Content processed successfully, but no summary was returned.");
        setStatus('success');
      } else {
        setSummary(`Error: ${data.error || 'Unknown error occurred'}`);
        setStatus('idle'); // Or error state if we had one
      }
    } catch (e: any) {
        setSummary(`Network Error: ${e.message}`);
        setStatus('idle');
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Context Ingestion</h1>
        <p className="text-muted-foreground mt-2">
          Manually feed text, documents, or logs into the global memory system for RAG retrieval.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Input Area */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-gray-800 bg-gray-950/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Raw Content
              </CardTitle>
              <CardDescription>
                Paste text here to have it summarized and stored in the vector database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Paste documentation, meeting notes, or code snippets here..." 
                className="min-h-[300px] font-mono text-sm bg-gray-900 border-gray-700"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </CardContent>
            <CardFooter className="flex justify-between">
              <span className="text-xs text-gray-500">
                {inputText.length} characters
              </span>
              <Button 
                onClick={handleIngest} 
                disabled={isProcessing || !inputText.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Ingest into Memory
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Status & Summary Area */}
        <div className="space-y-6">
           <Card className="border-gray-800 bg-gray-950/50 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                Ingestion Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800">
                <span className="text-sm text-gray-400">System Status</span>
                <Badge variant="outline" className="text-green-400 border-green-900 bg-green-900/20">
                  Online
                </Badge>
              </div>

              {status === 'success' && (
                <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-4 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center gap-2 mb-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold text-sm">Ingestion Complete</span>
                  </div>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}

              {status === 'idle' && (
                <div className="text-center py-10 text-gray-600 text-sm">
                  Ready to process content...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
