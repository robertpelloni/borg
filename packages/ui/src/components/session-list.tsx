'use client';

import { useEffect, useState, useCallback } from 'react';
import { useJules } from '@/lib/jules/provider';
import type { Session } from '@/types/jules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Archive, ArchiveRestore } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import { formatDistanceToNow, isValid, parseISO, isToday } from 'date-fns';
import { getArchivedSessions } from '@/lib/archive';

function truncateText(text: string, maxLength: number) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

interface SessionListProps {
  onSelectSession: (session: Session) => void;
  selectedSessionId?: string;
}

export function SessionList({ onSelectSession, selectedSessionId }: SessionListProps) {
  const { client } = useJules();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

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

  const loadSessions = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await client.listSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      if (err instanceof Error) {
        if (err.message.includes('Invalid API key')) {
          setError('Invalid API key. Please check your API key and try again.');
        } else if (err.message.includes('Resource not found')) {
          setSessions([]);
          setError(null);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load sessions');
      }
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const getStatusInfo = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return { color: 'bg-green-500', text: 'Active' };
      case 'completed':
        return { color: 'bg-blue-500', text: 'Done' };
      case 'failed':
        return { color: 'bg-red-500', text: 'Failed' };
      case 'paused':
        return { color: 'bg-yellow-500', text: 'Paused' };
      case 'awaiting_approval':
        return { color: 'bg-purple-500', text: 'Awaiting' };
      default:
        return { color: 'bg-gray-500', text: 'Unknown' };
    }
  };

  const getRepoShortName = (sourceId: string) => {
    const parts = sourceId.split('/');
    return parts[parts.length - 1] || sourceId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-xs text-muted-foreground">Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-xs text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={loadSessions} className="h-7 text-xs">
          Retry
        </Button>
      </div>
    );
  }

  const archivedSessions = getArchivedSessions();
  const visibleSessions = sessions
    .filter(session => showArchived ? archivedSessions.has(session.id) : !archivedSessions.has(session.id))
    .filter(session => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const title = (session.title || '').toLowerCase();
      const repo = (session.sourceId || '').toLowerCase();
      return title.includes(query) || repo.includes(query);
    });

  const dailySessionCount = sessions.filter(session => {
    if (!session.createdAt) return false;
    try {
      return isToday(parseISO(session.createdAt));
    } catch {
      return false;
    }
  }).length;
  const sessionLimit = 100;
  const percentage = Math.min((dailySessionCount / sessionLimit) * 100, 100);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.08] shrink-0 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={showArchived ? "Search archived..." : "Search sessions..."}
              aria-label="Search sessions"
              className="h-7 w-full bg-black/50 pl-7 text-[10px] border-white/10 focus-visible:ring-purple-500/50 placeholder:text-muted-foreground/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showArchived ? "secondary" : "ghost"}
                size="icon"
                className={`h-7 w-7 ${showArchived ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">
              {showArchived ? "Show Active Sessions" : "Show Archived Sessions"}
            </TooltipContent>
          </Tooltip>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {visibleSessions.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {searchQuery
                    ? 'No matching sessions found.'
                    : showArchived
                    ? 'No archived sessions.'
                    : sessions.length === 0
                    ? 'No sessions yet. Create one!'
                    : 'All sessions archived.'}
                </p>
              </div>
            ) : (
              visibleSessions.map((session) => (
                <CardSpotlight
                  key={session.id}
                  radius={250}
                  color={selectedSessionId === session.id ? '#a855f7' : '#404040'}
                  className={`relative ${
                    selectedSessionId === session.id ? 'border-purple-500/30' : ''
                  } ${showArchived ? 'opacity-70 grayscale-[0.5]' : ''}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Select session ${session.title || 'Untitled'}`}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left relative z-10 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-purple-500/50"
                    onClick={() => onSelectSession(session)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSession(session);
                      }
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex-shrink-0 mt-1 w-2 h-2 rounded-full ${getStatusInfo(session.status).color}`} />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-white text-[10px]">
                        <p>Status: {session.status}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 w-full min-w-0">
                        <div className="text-[10px] font-bold leading-tight text-white uppercase tracking-wide flex-1 min-w-0 block overflow-hidden text-ellipsis whitespace-nowrap">
                          {truncateText(session.title || 'Untitled', 30)}
                        </div>
                        {session.sourceId && (
                          <Badge className="shrink-0 text-[9px] px-1.5 py-0 h-4 font-mono bg-white/10 text-white/70 hover:bg-white/20 border-0 rounded-sm uppercase tracking-wider">
                            {getRepoShortName(session.sourceId)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-white/40 leading-tight font-mono tracking-wide">
                        <span>{formatDate(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardSpotlight>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Session Limit Indicator */}
        <div className="border-t border-white/[0.08] px-3 py-2.5 bg-black/50 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
              DAILY
            </span>
            <span className="text-[10px] font-mono font-bold text-white/60">
              {dailySessionCount}/{sessionLimit}
            </span>
          </div>
          <div className="w-full h-1 bg-white/5 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
