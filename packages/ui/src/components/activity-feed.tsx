'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useJules } from '@/lib/jules/provider';
import type { Activity, Session } from '@/types/jules';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { Send, Archive, ArchiveRestore, Code, Terminal, ChevronDown, ChevronRight, Play, GitBranch, GitPullRequest, MoreVertical, Book, ArrowUp, ArrowDown, Download, Copy, Check } from 'lucide-react';
import { archiveSession, unarchiveSession, isSessionArchived } from '@/lib/archive';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BashOutput } from '@/components/ui/bash-output';
import { NewSessionDialog } from './new-session-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { PlanContent } from './plan-content';

interface ActivityFeedProps {
  session: Session;
  onArchive?: () => void;
  showCodeDiffs: boolean;
  onToggleCodeDiffs: (show: boolean) => void;
  onActivitiesChange: (activities: Activity[]) => void;
}

export function ActivityFeed({ session, onArchive, showCodeDiffs, onToggleCodeDiffs, onActivitiesChange }: ActivityFeedProps) {
  const { client } = useJules();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [approvingPlan, setApprovingPlan] = useState(false);
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState(false);

  // Check archive status on session change
  useEffect(() => {
    setIsArchived(isSessionArchived(session.id));
  }, [session.id]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';

    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Unknown date';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown date';
    }
  };

  const formatContent = (content: string, metadata?: Record<string, unknown>) => {
    // 1. Handle Placeholders
    if (content === '[userMessaged]' || content === '[agentMessaged]') {
        // Try to recover content from metadata if available
        const realContent = metadata?.original_content || metadata?.message || metadata?.text;
        if (realContent && typeof realContent === 'string') {
             // If we found real content, recursively format it
             return formatContent(realContent, undefined);
        }

        if (content === '[userMessaged]') return <span className="text-white/50 italic">Message sent</span>;
        if (content === '[agentMessaged]') return <span className="text-white/50 italic">Agent working...</span>;
    }

    // 2. Try JSON Parsing
    if (content.startsWith('{') || content.startsWith('[')) {
        try {
          const parsed = JSON.parse(content);

          // Handle Empty JSON
          if (typeof parsed === 'object' && parsed !== null) {
             if (Array.isArray(parsed) && parsed.length === 0) return null;
             if (!Array.isArray(parsed) && Object.keys(parsed).length === 0) return null;
          }

          // Handle Plan Content
          if (Array.isArray(parsed) || (parsed.steps && Array.isArray(parsed.steps))) {
            return <PlanContent content={parsed} />;
          }

          return <pre className="text-[11px] overflow-x-auto font-mono bg-muted/50 p-2 rounded">{JSON.stringify(parsed, null, 2)}</pre>;
        } catch {
          // Fall through to markdown
        }
    }

    // 3. Render as Markdown
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:text-xs prose-p:leading-relaxed prose-p:break-words prose-headings:text-xs prose-headings:font-semibold prose-headings:mb-1 prose-headings:mt-2 prose-ul:text-xs prose-ol:text-xs prose-li:text-xs prose-li:my-0.5 prose-code:text-[11px] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:break-all prose-pre:text-[11px] prose-pre:bg-muted prose-pre:p-2 prose-pre:overflow-x-auto prose-blockquote:text-xs prose-blockquote:border-l-primary prose-strong:font-semibold">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
  };

  const loadActivities = useCallback(async (isInitialLoad = true) => {
    if (!client) {
      setLoading(false);
      return;
    }

    try {
      if (isInitialLoad) setLoading(true);
      setError(null);

      // Get session details to ensure we have the prompt
      const sessionDetails = await client.getSession(session.id);
      const data = await client.listActivities(session.id);

      // Prepend initial prompt if missing
      if (sessionDetails.prompt) {
         const hasPrompt = data.some(a => a.content === sessionDetails.prompt);
         if (!hasPrompt) {
            data.unshift({
              id: 'initial-prompt',
              sessionId: session.id,
              type: 'message',
              role: 'user',
              content: sessionDetails.prompt,
              createdAt: session.createdAt
            });
         }
      }

      setActivities(prevActivities => {
        if (prevActivities.length === 0 || isInitialLoad) return data;

        const prevIds = new Set(prevActivities.map(a => a.id));
        const newActivities = data.filter(newAct => !prevIds.has(newAct.id));

        if (newActivities.length > 0) {
          setNewActivityIds(new Set(newActivities.map(a => a.id)));
          setTimeout(() => setNewActivityIds(new Set()), 500);
          return [...prevActivities, ...newActivities];
        }
        return prevActivities;
      });
    } catch (err) {
      console.error('Failed to load activities:', err);
      if (err instanceof Error && err.message.includes('Resource not found')) {
        setActivities([]);
        setError(null);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load activities';
        setError(errorMessage);
        if (isInitialLoad) setActivities([]);
      }
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [client, session.id, session.createdAt]);

  useEffect(() => {
    loadActivities(true);
    // Only poll if active AND not archived
    if (session.status === 'active' && !isArchived) {
      const interval = setInterval(() => loadActivities(false), 5000);
      return () => clearInterval(interval);
    }
  }, [session.id, session.status, isArchived, loadActivities]);

  useEffect(() => {
    onActivitiesChange(activities);
  }, [activities, onActivitiesChange]);

  const handleApprovePlan = async () => {
    if (!client || approvingPlan || isArchived) return;
    try {
      setApprovingPlan(true);
      setError(null);
      await client.approvePlan(session.id);
      setTimeout(async () => {
        try { await loadActivities(false); } catch (err) { console.error(err); }
      }, 1000);
    } catch (err) {
      console.error('Failed to approve plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve plan');
    } finally {
      setApprovingPlan(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !client || sending || isArchived) return;
    try {
      setSending(true);
      setError(null);
      const userMessage = await client.createActivity({
        sessionId: session.id,
        content: message.trim(),
      });
      setActivities([...activities, userMessage]);
      setMessage('');
      setTimeout(async () => {
        try { await loadActivities(false); } catch (err) { console.error(err); }
      }, 2000);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleArchive = () => {
    archiveSession(session.id);
    setIsArchived(true);
    onArchive?.();
  };

  const handleUnarchive = () => {
    unarchiveSession(session.id);
    setIsArchived(false);
    onArchive?.(); // Reuse callback to notify list refresh
  };

  const toggleCodeDiffsSidebar = () => {
    onToggleCodeDiffs(!showCodeDiffs);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = (format: 'json' | 'txt' | 'md') => {
    let content = '';
    const filename = `session-${session.id.substring(0, 8)}.${format}`;

    if (format === 'json') {
      content = JSON.stringify(activities, null, 2);
    } else {
      content = activities.map(a => {
        const header = `[${formatDate(a.createdAt)}] ${a.role.toUpperCase()} (${a.type})`;
        return format === 'md'
          ? `### ${header}\n\n${a.content}\n\n`
          : `${header}\n${a.content}\n\n-------------------\n\n`;
      }).join('');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToTop = () => {
    const scrollContainer = document.querySelector('#activity-feed-scroll-area [data-radix-scroll-area-viewport]');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  };

  const scrollToBottom = () => {
    const scrollContainer = document.querySelector('#activity-feed-scroll-area [data-radix-scroll-area-viewport]');
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
  };

  const finalDiff = activities.filter(activity => activity.diff).slice(-1);
  const hasDiffs = finalDiff.length > 0;
  const outputBranch = session.branch || 'main';
  const [expandedBashOutputs, setExpandedBashOutputs] = useState<Set<string>>(new Set());

  const toggleBashOutput = (activityId: string) => {
    setExpandedBashOutputs(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const getActivityIcon = (activity: Activity) => {
    if (activity.role === 'user') {
      return <AvatarFallback className="bg-purple-500 text-white text-[9px] font-bold uppercase tracking-wider">U</AvatarFallback>;
    }
    return <AvatarFallback className="bg-white text-black text-[9px] font-bold uppercase tracking-wider">J</AvatarFallback>;
  };

  const getActivityTypeColor = (type: Activity['type']) => {
    switch (type) {
      case 'message': return 'bg-blue-500';
      case 'plan': return 'bg-purple-500';
      case 'progress': return 'bg-yellow-500';
      case 'result': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Loading activities...</p>
      </div>
    );
  }

  const filteredActivities = activities.filter((activity) => {
    if (activity.bashOutput || activity.diff || activity.media) return true;
    const content = activity.content?.trim();
    if (!content) return false;

    // Aggressive filter for empty JSON/Arrays (including whitespace)
    const cleanContent = content.replace(/\s/g, '');
    if (cleanContent === '{}' || cleanContent === '[]') return false;

    // Filter empty parsed JSON objects
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
          if (Array.isArray(parsed) && parsed.length === 0) return false;
          if (!Array.isArray(parsed) && Object.keys(parsed).length === 0) return false;
        }
      } catch {
        // Not valid JSON, process as text
      }
    }

    return true;
  });

  const latestActivity = filteredActivities.length > 0 ? filteredActivities[filteredActivities.length - 1] : null;
  const sessionDuration = session.createdAt ? Math.floor((new Date().getTime() - new Date(session.createdAt).getTime()) / 1000 / 60) : 0;

  const getStatusInfo = () => {
    if (session.status === 'active') return { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Active', icon: '●' };
    if (session.status === 'completed') return { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Completed', icon: '✓' };
    if (session.status === 'failed') return { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Failed', icon: '✕' };
    if (session.status === 'paused') return { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Paused', icon: '⏸' };
    return { color: 'text-gray-500', bgColor: 'bg-gray-500/10', label: session.status, icon: '○' };
  };

  const statusInfo = getStatusInfo();

  // Check for PR
  const pullRequest = session.outputs?.find(o => o.pullRequest)?.pullRequest;

  return (
    <div className="flex flex-col h-full bg-black relative">
      <div className="border-b border-white/[0.08] bg-zinc-950/95 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-sm font-bold uppercase tracking-wide truncate text-white">{session.title}</h2>
              <div className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${statusInfo.bgColor} ${statusInfo.color}`}>
                <span>{statusInfo.icon}</span>
                <span>{statusInfo.label}</span>
              </div>
              {pullRequest && (
                <a
                  href={pullRequest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-green-500/10 text-green-400 hover:text-green-300 hover:underline border border-green-500/20 rounded"
                >
                  <GitPullRequest className="h-3 w-3" />
                  <span>PR Created</span>
                </a>
              )}
            </div>
            <div className="flex items-center gap-3 text-[9px] font-mono text-white/40 uppercase tracking-wide">
              <span>Started {formatDate(session.createdAt)}</span>
              <span>•</span>
              <div className="flex items-center gap-1 text-white/60">
                <Book className="h-3 w-3" />
                <span>{session.sourceId}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                <span>{session.branch || 'main'}</span>
              </div>
              {session.status === 'active' && (
                <>
                  <span>•</span>
                  <span>Running {sessionDuration}m</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {hasDiffs && (
              <Button variant="ghost" size="icon" onClick={toggleCodeDiffsSidebar} className={`h-7 w-7 hover:bg-white/5 ${showCodeDiffs ? 'bg-purple-500/20 text-purple-400' : 'text-white/60'}`}>
                <Code className="h-3.5 w-3.5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5 text-white/60">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-white/10 text-white/80">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    <Download className="mr-2 h-3.5 w-3.5" /> Export Chat
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-zinc-950 border-white/10 text-white/80">
                    <DropdownMenuItem onClick={() => handleExport('md')} className="text-xs cursor-pointer">Markdown</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('txt')} className="text-xs cursor-pointer">Text</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')} className="text-xs cursor-pointer">JSON</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => handleCopy(JSON.stringify(activities, null, 2), 'full')} className="text-xs cursor-pointer">
                  {copiedId === 'full' ? <Check className="mr-2 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  Copy Full JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                {isArchived ? (
                  <DropdownMenuItem onClick={handleUnarchive} className="text-xs cursor-pointer text-purple-400 focus:text-purple-400">
                    <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                    Unarchive Session
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleArchive} className="text-xs cursor-pointer text-red-400 focus:text-red-400">
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    Archive Session
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {isArchived && (
        <div className="bg-zinc-900 border-b border-white/[0.08] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-white/40" />
            <span className="text-[11px] font-mono text-white/60 uppercase tracking-wide">Archived Session (Read-only)</span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleUnarchive} className="h-6 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
            Unarchive
          </Button>
        </div>
      )}

      {error && (
        <div className="border-b border-white/[0.08] bg-red-950/20 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-mono text-red-400 uppercase tracking-wide">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadActivities(true)} className="h-7 text-[10px] border-white/10 hover:bg-white/5 text-white/80">Retry</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative group">
        <ScrollArea className="h-full" ref={scrollAreaRef} id="activity-feed-scroll-area">
          <div className="p-3 space-y-2.5">
            {filteredActivities.length === 0 && !loading && !error && (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">No activities yet</p>
                </div>
              </div>
            )}
            {(() => {
              const grouped: Array<Activity | Activity[]> = [];
              let currentGroup: Activity[] | null = null;

              filteredActivities.forEach((activity, index) => {
                const shouldGroup = activity.type === 'progress' && activity.role === 'agent';
                const prevActivity = index > 0 ? filteredActivities[index - 1] : null;
                const prevShouldGroup = prevActivity && prevActivity.type === 'progress' && prevActivity.role === 'agent';

                if (shouldGroup) {
                  if (prevShouldGroup && currentGroup) currentGroup.push(activity);
                  else {
                    currentGroup = [activity];
                    grouped.push(currentGroup);
                  }
                } else {
                  currentGroup = null;
                  grouped.push(activity);
                }
              });

              return grouped.map((item, groupIndex) => {
                if (Array.isArray(item)) {
                  const firstActivity = item[0];
                  // Filter nulls (empty JSONs that slipped)
                  const validItems = item.filter(a => formatContent(a.content, a.metadata) !== null);
                  if (validItems.length === 0) return null;

                  return (
                    <div key={`group-${groupIndex}`} className="flex gap-2.5">
                      <Avatar className="h-6 w-6 shrink-0 mt-0.5 bg-zinc-900 border border-white/10">{getActivityIcon(firstActivity)}</Avatar>
                      <Card className="flex-1 border-white/[0.08] bg-zinc-950/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono uppercase tracking-wider bg-yellow-500/90 border-transparent text-black font-bold">progress</Badge>
                            <span className="text-[9px] font-mono text-white/40 tracking-wide">{validItems.length} updates</span>
                          </div>
                          <div className="space-y-2">
                            {validItems.map((activity, idx) => (
                              <div key={activity.id} className={idx > 0 ? 'pt-2 border-t border-white/[0.08]' : ''}>
                                <div className="text-[11px] leading-relaxed text-white/90 break-words">{formatContent(activity.content, activity.metadata)}</div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                }

                const activity = item;
                const contentNode = formatContent(activity.content, activity.metadata);
                // Allow rendering if media is present, even if content is empty (though activity filter handles this)
                if (contentNode === null && !activity.media) return null;

                // Only show approve button if session is waiting for approval AND this is the latest plan AND not archived
                const showApprove = !isArchived && activity.type === 'plan' && session.status === 'awaiting_approval';

                return (
                  <div key={activity.id} className={`flex gap-2.5 ${activity.role === 'user' ? 'flex-row-reverse' : ''} ${newActivityIds.has(activity.id) ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : ''}`}>
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5 bg-zinc-900 border border-white/10">{getActivityIcon(activity)}</Avatar>
                    <Card className={`flex-1 border-white/[0.08] ${activity.role === 'user' ? 'bg-purple-950/20 border-purple-500/20' : 'bg-zinc-950/50'}`}>
                      <CardContent className="p-3 group/card relative">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 font-mono uppercase tracking-wider ${getActivityTypeColor(activity.type)} border-transparent text-black font-bold`}>{activity.type}</Badge>
                          <span className="text-[9px] font-mono text-white/40 tracking-wide">{formatDate(activity.createdAt)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-auto opacity-0 group-hover/card:opacity-100 transition-opacity"
                            onClick={() => handleCopy(activity.content, activity.id)}
                          >
                            {copiedId === activity.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-white/40" />}
                          </Button>
                        </div>

                        {activity.media && activity.media.data && (
                           <div className="mb-2 rounded overflow-hidden border border-white/10">
                              <img
                                src={`data:${activity.media.mimeType};base64,${activity.media.data}`}
                                alt="Generated Artifact"
                                className="max-w-full h-auto block"
                              />
                           </div>
                        )}

                        <div className="text-[11px] leading-relaxed text-white/90 break-words">{contentNode}</div>

                        {activity.bashOutput && (
                          <div className="mt-3 pt-3 border-t border-white/[0.08]">
                            <button onClick={() => toggleBashOutput(activity.id)} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-green-400 hover:text-green-300 transition-colors mb-2">
                              {expandedBashOutputs.has(activity.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              <Terminal className="h-3.5 w-3.5" />
                              <span>Command Output</span>
                            </button>
                            {expandedBashOutputs.has(activity.id) && <BashOutput output={activity.bashOutput} />}
                          </div>
                        )}
                        {showApprove && (
                          <div className="mt-3 pt-3 border-t border-white/[0.08]">
                            <Button onClick={handleApprovePlan} disabled={approvingPlan} size="sm" className="h-7 px-3 text-[9px] font-mono uppercase tracking-widest bg-purple-600 hover:bg-purple-500 text-white border-0">
                              {approvingPlan ? 'Approving...' : 'Approve Plan'}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              });
            })()}
          </div>
        </ScrollArea>

        {/* Floating Jump Buttons */}
        <div className="absolute right-4 bottom-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800" onClick={scrollToTop} title="Jump to Top">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800" onClick={scrollToBottom} title="Jump to Bottom">
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isArchived && session.status !== 'failed' && (
        <form onSubmit={handleSendMessage} className="border-t border-white/[0.08] bg-zinc-950/95 p-3">
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send a message to Jules..."
              className="min-h-[56px] resize-none text-[11px] bg-black border-white/[0.08] text-white placeholder:text-white/30 focus:border-purple-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={sending}
            />
            <Button type="submit" size="icon" aria-label="Send message" disabled={!message.trim() || sending} className="h-9 w-9 bg-purple-600 hover:bg-purple-500 text-white">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      )}
      {session.status === 'failed' && (
        <div className="border-t border-white/[0.08] bg-zinc-950/95 p-3 text-center">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            Session {session.status} • Cannot send new messages
          </p>
        </div>
      )}
    </div>
  );
}
