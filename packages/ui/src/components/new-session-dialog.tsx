'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useJules } from '@/lib/jules/provider';
import type { Source, SessionTemplate } from '@/types/jules';
import { getTemplates } from '@/lib/templates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Plus, Loader2, Save, Sparkles, LayoutTemplate } from 'lucide-react';
import { TemplateFormDialog } from '@/components/template-form-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface NewSessionDialogProps {
  onSessionCreated?: () => void;
  initialValues?: {
    sourceId?: string;
    title?: string;
    prompt?: string;
    startingBranch?: string;
  };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NewSessionDialog({ onSessionCreated, initialValues, trigger, open: controlledOpen, onOpenChange: setControlledOpen }: NewSessionDialogProps) {
  const { client } = useJules();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateCreateValues, setTemplateCreateValues] = useState<Partial<SessionTemplate> | undefined>(undefined);
  
  const [sources, setSources] = useState<Source[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    sourceId: '',
    title: '',
    prompt: '',
    startingBranch: '',
    autoCreatePr: false,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadSources = useCallback(async (query: string = '') => {
    if (!client) return;

    try {
      setError(null);
      // Pass filter to listSources if query exists
      const data = await client.listSources(query || undefined);
      setSources(data);

      // Auto-select first if we have data and nothing selected, BUT only on initial load (empty query)
      // Otherwise keep selection or let user pick.
      if (!query && data.length > 0 && !formData.sourceId) {
        setFormData((prev) => ({ ...prev, sourceId: data[0].id }));
      }

      if (data.length === 0 && !query) {
        setError('No repositories found. Please connect a GitHub repository in the Jules web app first.');
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
      if (err instanceof Error && err.message.includes('Resource not found')) {
        setError('Unable to load repositories. Please ensure you have connected at least one GitHub repository in the Jules web app.');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load repositories';
        setError(errorMessage);
      }
    }
  }, [client, formData.sourceId]);

  const handleSearchChange = (query: string) => {
    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
        loadSources(query);
    }, 500); // 500ms debounce
  };

  const loadTemplatesList = useCallback(() => {
    setTemplates(getTemplates());
  }, []);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setFormData(prev => ({
          ...prev,
          sourceId: initialValues.sourceId || prev.sourceId,
          title: initialValues.title || prev.title,
          prompt: initialValues.prompt || prev.prompt,
          startingBranch: initialValues.startingBranch || prev.startingBranch,
        }));
      }
      
      if (client) {
        loadSources(); // Initial load
      }
      loadTemplatesList();
    }
    return () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [open, client, loadSources, loadTemplatesList, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !formData.sourceId || !formData.prompt) return;

    try {
      setLoading(true);
      setError(null);
      await client.createSession({
        sourceId: formData.sourceId,
        prompt: formData.prompt,
        title: formData.title || undefined,
        startingBranch: formData.startingBranch || undefined,
        autoCreatePr: formData.autoCreatePr,
      });
      setOpen(false);
      setFormData({ sourceId: '', title: '', prompt: '', startingBranch: '', autoCreatePr: false });
      setSelectedTemplateId('');
      setError(null);
      onSessionCreated?.();
    } catch (err) {
      console.error('Failed to create session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title || prev.title,
        prompt: template.prompt
      }));
    }
  };

  const openSaveTemplate = () => {
    setTemplateCreateValues({
      prompt: formData.prompt,
      title: formData.title
    });
    setSaveTemplateOpen(true);
  };

  const onTemplateSaved = () => {
    loadTemplatesList();
  };

  return (
    <>
      <TemplateFormDialog 
        open={saveTemplateOpen} 
        onOpenChange={setSaveTemplateOpen}
        initialValues={templateCreateValues}
        onSave={onTemplateSaved}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button className="w-full sm:w-auto h-8 text-[10px] font-mono uppercase tracking-widest bg-purple-600 hover:bg-purple-500 text-white border-0">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Session
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px] border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
          <DialogHeader>
            <DialogTitle className="text-base">Create New Session</DialogTitle>
            <DialogDescription className="text-xs">
              Start a new Jules session by selecting a source and providing instructions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">

            {templates.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-purple-400" />
                    Start with a Template
                  </Label>
                  <span className="text-[10px] text-muted-foreground">{templates.length} available</span>
                </div>
                <ScrollArea className="w-full whitespace-nowrap rounded-md border border-white/10 bg-black/20">
                  <div className="flex w-max space-x-2.5 p-2.5">
                    {templates.map((template) => (
                      <Card
                        key={template.id}
                        className={`w-[140px] shrink-0 cursor-pointer transition-all hover:bg-white/5 hover:border-purple-500/50 ${selectedTemplateId === template.id ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/50' : 'border-white/10 bg-zinc-900/50'}`}
                        onClick={() => handleTemplateSelect(template.id)}
                      >
                        <CardContent className="p-2.5 flex flex-col h-full justify-between gap-2">
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <h3 className="text-[10px] font-bold text-white truncate uppercase tracking-wide" title={template.name}>{template.name}</h3>
                              {template.isFavorite && <Sparkles className="h-2 w-2 text-yellow-400 shrink-0" />}
                            </div>
                            <p className="text-[9px] text-white/50 truncate line-clamp-2 whitespace-normal h-[24px] leading-tight font-mono">
                               {template.description || template.prompt.substring(0, 50)}
                            </p>
                          </div>
                          {selectedTemplateId === template.id && (
                             <div className="text-[8px] font-mono text-purple-300 bg-purple-500/20 rounded px-1.5 py-0.5 text-center uppercase tracking-widest">Selected</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" className="h-2.5" />
                </ScrollArea>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="source" className="text-xs font-semibold">Source Repository</Label>
              <Combobox
                id="source"
                options={sources.map((source) => ({
                  value: source.id,
                  label: source.name,
                }))}
                value={formData.sourceId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, sourceId: value }))
                }
                onSearchChange={handleSearchChange}
                placeholder={sources.length === 0 ? "No repositories available" : "Select a repository"}
                searchPlaceholder="Search repositories (server-side)..."
                emptyMessage="No repositories found."
                className={`text-xs ${sources.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              {sources.length === 0 && !error && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Connect a repository at{' '}
                  <a
                    href="https://jules.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    jules.google.com
                  </a>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch" className="text-xs font-semibold">Branch Name (Optional)</Label>
              <Input
                id="branch"
                placeholder="main"
                value={formData.startingBranch}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startingBranch: e.target.value }))
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold">Session Title (Optional)</Label>
              <Input
                id="title"
                placeholder="e.g., Fix authentication bug"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="prompt" className="text-xs font-semibold">Instructions</Label>
                {formData.prompt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[10px] text-muted-foreground hover:text-white"
                    onClick={openSaveTemplate}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save as Template
                  </Button>
                )}
              </div>
              <Textarea
                id="prompt"
                placeholder="Describe what you want Jules to do..."
                value={formData.prompt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                }
                className="min-h-[100px] max-h-[200px] overflow-y-auto text-xs"
                required
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="autoCreatePr"
                className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-black/20 border-white/20"
                checked={formData.autoCreatePr}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, autoCreatePr: e.target.checked }))
                }
              />
              <label
                htmlFor="autoCreatePr"
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white/80"
              >
                Automatically create Pull Request when ready
              </label>
            </div>

            {error && (
              <div className="rounded bg-destructive/10 p-2.5">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.sourceId || !formData.prompt} className="h-8 text-xs">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Session'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}