'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Download, Loader2, FileJson, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ExportSessionDialogProps {
  sessionId: string;
  sessionTitle?: string;
  trigger?: React.ReactNode;
}

export function ExportSessionDialog({ sessionId, sessionTitle, trigger }: ExportSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'json' | 'markdown'>('json');
  const [includeActivities, setIncludeActivities] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [includeDebates, setIncludeDebates] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          format,
          includeActivities,
          includeLogs,
          includeDebates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      const filename = `session-${sessionId.split('/').pop()}.${format === 'markdown' ? 'md' : 'json'}`;

      if (format === 'markdown') {
        const text = await response.text();
        downloadFile(text, filename, 'text/markdown');
      } else {
        const data = await response.json();
        downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
      }

      toast.success('Session exported successfully');
      setOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export session');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Export Session</DialogTitle>
          <DialogDescription className="text-white/60">
            {sessionTitle ? `Export "${sessionTitle}"` : 'Export session data'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/80">Format</Label>
            <Select value={format} onValueChange={(v: 'json' | 'markdown') => setFormat(v)}>
              <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                <SelectItem value="json" className="text-white">
                  <span className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON
                  </span>
                </SelectItem>
                <SelectItem value="markdown" className="text-white">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Markdown
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium text-white/80">Include</Label>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="activities" className="text-white/70">
                Activities (messages, responses)
              </Label>
              <Switch
                id="activities"
                checked={includeActivities}
                onCheckedChange={setIncludeActivities}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="logs" className="text-white/70">
                Keeper logs
              </Label>
              <Switch
                id="logs"
                checked={includeLogs}
                onCheckedChange={setIncludeLogs}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="debates" className="text-white/70">
                Debate history
              </Label>
              <Switch
                id="debates"
                checked={includeDebates}
                onCheckedChange={setIncludeDebates}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="text-white/60">
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading} className="bg-purple-600 hover:bg-purple-500">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
