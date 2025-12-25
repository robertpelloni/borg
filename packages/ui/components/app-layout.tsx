"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useJules } from "@/lib/jules/provider";
import type { Session, Activity, SessionTemplate } from "@/types/jules";
import { SessionList } from "./session-list";
import { ActivityFeed } from "./activity-feed";
import { CodeDiffSidebar } from "./code-diff-sidebar";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { NewSessionDialog } from "./new-session-dialog";
import { TemplatesPage } from "./templates-page";
import { KanbanBoard } from "./kanban-board";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  LogOut,
  Settings,
  BarChart3,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Terminal as TerminalIcon,
  LayoutTemplate,
  Plus,
  Kanban,
  Activity as ActivityIcon,
  Server,
} from "lucide-react";
import { TerminalPanel } from "./terminal-panel";
import { useTerminalAvailable } from "@/hooks/use-terminal-available";
import { ApiKeySetupForm } from "./api-key-setup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SessionKeeperLogPanel } from "./session-keeper-log-panel";
import { SessionKeeperSettings } from "./session-keeper-settings";
import { SessionKeeperManager } from "./session-keeper-manager";
import { useSessionKeeperStore } from "@/lib/stores/session-keeper";
import { SystemDashboard } from "./system-dashboard";

interface AppLayoutProps {
  initialView?: "sessions" | "analytics" | "templates" | "kanban" | "system";
}

export function AppLayout({ initialView }: AppLayoutProps) {
  const { client, apiKey, clearApiKey } = useJules();
  const { config, setConfig } = useSessionKeeperStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAvailable: terminalAvailable } = useTerminalAvailable();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [view, setView] = useState<
    "sessions" | "analytics" | "templates" | "kanban" | "system"
  >(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined") {
      const savedView = localStorage.getItem("jules-current-view");
      if (
        savedView &&
        ["sessions", "analytics", "templates", "kanban", "system"].includes(savedView)
      ) {
        return savedView as "sessions" | "analytics" | "templates" | "kanban" | "system";
      }
    }
    return "sessions";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [codeDiffSidebarCollapsed, setCodeDiffSidebarCollapsed] = useState(false);
  // Replaced keeperSidebarCollapsed with direct logs toggle state
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [showCodeDiffs, setShowCodeDiffs] = useState(false);
  const [currentActivities, setCurrentActivities] = useState<Activity[]>([]);
  const [codeSidebarWidth, setCodeSidebarWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("terminal-open") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("jules-current-view", view);
  }, [view]);

  // State for New Session Dialog (Controlled)
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [newSessionInitialValues, setNewSessionInitialValues] = useState<
    | {
        sourceId?: string;
        title?: string;
        prompt?: string;
        startingBranch?: string;
      }
    | undefined
  >(undefined);

  // Sync session selection with URL query param
  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (sessionId && client) {
      if (selectedSession?.id !== sessionId) {
        // Load session details
        client.getSession(sessionId)
          .then(session => {
            setSelectedSession(session);
            setView('sessions');
          })
          .catch(err => {
            console.error('Failed to load session from URL', err);
            // Optionally clear param if invalid
          });
      }
    }
  }, [searchParams, client, selectedSession?.id]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        if (newWidth > 300 && newWidth < 1200) {
          setCodeSidebarWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
    setView("sessions");
    setMobileMenuOpen(false);

    // Fetch full details to ensure we have everything (like sourceId, stats, etc.)
    if (client) {
      client.getSession(session.id).then(fullSession => {
        setSelectedSession(fullSession);
      }).catch(err => console.error("Failed to fetch full session details", err));
    }

    // Update URL without refreshing
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('sessionId', session.id);
    router.push(`/jules?${newParams.toString()}`);
  };

  const handleSessionCreated = () => {
    setRefreshKey((prev) => prev + 1);
    setIsNewSessionOpen(false);
  };

  const handleSessionArchived = () => {
    // Clear the selected session and refresh the session list
    setSelectedSession(null);
    setRefreshKey((prev) => prev + 1);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('sessionId');
    router.push(`/jules?${newParams.toString()}`);
  };

  const handleLogout = () => {
    clearApiKey();
    setSelectedSession(null);
  };

  const handleToggleTerminal = useCallback(() => {
    setTerminalOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem("terminal-open", String(newValue));
      return newValue;
    });
  }, []);

  const handleStartSessionFromTemplate = (template: SessionTemplate) => {
    if (!apiKey) {
      setIsApiKeyDialogOpen(true);
      return;
    }
    setNewSessionInitialValues({
      prompt: template.prompt,
      title: template.title,
    });
    setIsNewSessionOpen(true);
  };

  const handleOpenNewSession = () => {
    if (!apiKey) {
      setIsApiKeyDialogOpen(true);
      return;
    }
    setNewSessionInitialValues(undefined);
    setIsNewSessionOpen(true);
  };

  const handleApiKeySuccess = () => {
    setIsApiKeyDialogOpen(false);
    // User probably wants to try again after setting API key
  };

  return (
    <div className="flex h-screen flex-col bg-black max-w-full overflow-hidden">
      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">API Key Required</DialogTitle>
            <DialogDescription className="text-white/40">
              Enter your Jules API key to start a session.
            </DialogDescription>
          </DialogHeader>
          <ApiKeySetupForm onSuccess={handleApiKeySuccess} />
        </DialogContent>
      </Dialog>
      <SessionKeeperManager />
      {/* Header */}
      <header className="border-b border-white/[0.08] bg-zinc-950/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-2 sm:px-4">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  aria-label="Toggle mobile menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[280px] p-0 bg-zinc-950 border-white/[0.08]"
              >
                <SheetHeader className="border-b border-white/[0.08] px-3 py-2.5">
                  <SheetTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    SESSIONS
                  </SheetTitle>
                </SheetHeader>
                <SessionList
                  key={refreshKey}
                  onSelectSession={handleSessionSelect}
                  selectedSessionId={selectedSession?.id}
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-sm font-bold tracking-tight text-white">
              JULES
            </h1>

            {/* GitHub Repo Link */}
            {selectedSession?.sourceId && (
              <a
                href={`https://github.com/${selectedSession.sourceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 ml-4"
              >
                <span className="opacity-50">Repo:</span> {selectedSession.sourceId}
              </a>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pl-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 hover:bg-white/5 ${view === "kanban" ? "text-white" : "text-white/60"}`}
              onClick={() => setView("kanban")}
              aria-pressed={view === "kanban"}
            >
              <Kanban className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
                Board
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 hover:bg-white/5 ${view === "sessions" ? "text-white" : "text-white/60"}`}
              onClick={() => setView("sessions")}
              aria-pressed={view === "sessions"}
            >
              <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
                Sessions
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 hover:bg-white/5 ${view === "analytics" ? "text-white" : "text-white/60"}`}
              onClick={() => setView("analytics")}
              aria-pressed={view === "analytics"}
            >
              <BarChart3 className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
                Analytics
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 hover:bg-white/5 ${view === "system" ? "text-white" : "text-white/60"}`}
              onClick={() => setView("system")}
              aria-pressed={view === "system"}
            >
              <Server className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
                System
              </span>
            </Button>

            {/* Logs Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 hover:bg-white/5 ${isLogPanelOpen ? 'text-purple-500' : 'text-white/60'}`}
              onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
              title="Toggle Auto-Pilot Logs"
            >
              <ActivityIcon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">Logs</span>
            </Button>

            {terminalAvailable && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-3 hover:bg-white/5 ${terminalOpen ? "text-green-500" : "text-white/60"}`}
                onClick={handleToggleTerminal}
                title="Toggle Terminal (Ctrl+`)"
                aria-label="Toggle Terminal"
                aria-pressed={terminalOpen}
              >
                <TerminalIcon className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
                  Terminal
                </span>
              </Button>
            )}

            <NewSessionDialog
              onSessionCreated={handleSessionCreated}
              open={isNewSessionOpen}
              onOpenChange={setIsNewSessionOpen}
              initialValues={newSessionInitialValues}
              trigger={
                <Button
                  className="w-full sm:w-auto h-8 text-[10px] font-mono uppercase tracking-widest border-0 px-2 sm:px-4"
                  onClick={handleOpenNewSession}
                >
                  <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">New Session</span>
                  <span className="sm:hidden">New</span>
                </Button>
              }
            />

            {/* Session Keeper Settings (Controlled) */}
            <SessionKeeperSettings 
              config={config}
              onConfigChange={setConfig}
              open={isSettingsOpen} 
              onOpenChange={setIsSettingsOpen} 
              trigger={null} 
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-white/5 text-white/60"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-zinc-950 border-white/[0.08]"
              >
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setIsSettingsOpen(true);
                  }}
                  className="hover:bg-white/5 text-white/80"
                >
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  <span className="text-xs uppercase tracking-wide">
                    Auto-Pilot Settings
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/10" />

                <DropdownMenuItem
                  onClick={() => setView("templates")}
                  className="hover:bg-white/5 text-white/80"
                >
                  <LayoutTemplate className="mr-2 h-3.5 w-3.5" />
                  <span className="text-xs uppercase tracking-wide">
                    Manage Templates
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/10" />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="hover:bg-white/5 text-white/80"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  <span className="text-xs uppercase tracking-wide">
                    Logout
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Desktop Sidebar (Session List) */}
        <aside className={`hidden md:flex border-r border-white/[0.08] flex-col bg-zinc-950 transition-all duration-200 ${
          sidebarCollapsed ? 'md:w-12' : 'md:w-64'
        }`}>
          <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
            {!sidebarCollapsed && (
              <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">SESSIONS</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 hover:bg-white/5 text-white/60 ${sidebarCollapsed ? 'mx-auto' : ''}`}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            {!sidebarCollapsed && (
              <SessionList
                key={refreshKey}
                onSelectSession={handleSessionSelect}
                selectedSessionId={selectedSession?.id}
              />
            )}
          </div>
        </aside>
        {/* Resizable Panel Group (Vertical: Top = Main, Bottom = Logs) */}
        <ResizablePanelGroup 
          orientation="vertical" 
          className="flex-1 min-w-0 flex-col"
          key={isLogPanelOpen ? "vertical-layout-open" : "vertical-layout-closed"}
        >

          {/* Top Panel: Dashboard */}
          <ResizablePanel defaultSize={isLogPanelOpen ? 60 : 100} minSize={0} className="min-h-0">
            {/* Main Panel Content */}
            <div className="flex h-full w-full flex-row min-w-0">
              <main className="flex-1 overflow-hidden bg-black flex flex-col min-w-0">
                {view === 'analytics' ? (
                  <AnalyticsDashboard />
                ) : view === 'templates' ? (
                  <TemplatesPage onStartSession={handleStartSessionFromTemplate} />
                ) : view === 'system' ? (
                  <SystemDashboard />
                ) : selectedSession ? (
                  <ActivityFeed
                    key={selectedSession.id}
                    session={selectedSession}
                    onArchive={handleSessionArchived}
                    showCodeDiffs={showCodeDiffs}
                    onToggleCodeDiffs={setShowCodeDiffs}
                    onActivitiesChange={setCurrentActivities}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-8">
                    <div className="text-center space-y-4 max-w-sm">
                      <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">
                        NO SESSION
                      </h2>
                      <p className="text-[11px] text-white/30 leading-relaxed uppercase tracking-wide font-mono">
                        Select session or create new
                      </p>
                      <div className="pt-2">
                        <Button
                          className="w-full sm:w-auto h-8 text-[10px] font-mono uppercase tracking-widest bg-purple-600 hover:bg-purple-500 text-white border-0"
                          onClick={handleOpenNewSession}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          New Session
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </main>

              {/* Code Diff Sidebar (Existing) - Kept inside Main Panel */}
              {selectedSession && showCodeDiffs && view === 'sessions' && (
                <>
                  {!codeDiffSidebarCollapsed && (
                    <div
                      className="w-1 cursor-col-resize bg-transparent hover:bg-blue-500/50 transition-colors z-50"
                      onMouseDown={startResizing}
                    />
                  )}
                  <aside
                    className={`hidden md:flex border-l border-white/[0.08] flex-col bg-zinc-950 ${
                      isResizing ? 'transition-none' : 'transition-all duration-200'
                    } ${codeDiffSidebarCollapsed ? 'md:w-12' : ''}`}
                    style={{ width: codeDiffSidebarCollapsed ? undefined : codeSidebarWidth }}
                  >
                    <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
                      {!codeDiffSidebarCollapsed && (
                        <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">CODE CHANGES</h2>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 hover:bg-white/5 text-white/60 ${codeDiffSidebarCollapsed ? 'mx-auto' : ''}`}
                        onClick={() => setCodeDiffSidebarCollapsed(!codeDiffSidebarCollapsed)}
                      >
                        {codeDiffSidebarCollapsed ? (
                          <ChevronLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {!codeDiffSidebarCollapsed && (
                        <CodeDiffSidebar
                          activities={currentActivities}
                          repoUrl={selectedSession ? `https://github.com/${selectedSession.sourceId}` : undefined}
                        />
                      )}
                    </div>
                  </aside>
                </>
              )}
            </div>
          </ResizablePanel>

          {/* Bottom Panel: Logs */}
          {isLogPanelOpen && (
            <>
              <ResizableHandle 
                withHandle 
                className="h-2 w-full cursor-row-resize bg-zinc-900 border-y border-white/10 hover:bg-purple-500/20 transition-colors" 
              />
              <ResizablePanel defaultSize={40} minSize={0}>
                <SessionKeeperLogPanel onClose={() => setIsLogPanelOpen(false)} />
              </ResizablePanel>
            </>
          )}

        </ResizablePanelGroup>
      </div>

      {/* Terminal Panel */}
      {terminalAvailable && (
        <TerminalPanel
          sessionId={selectedSession?.id || "global"}
          repositoryPath=""
          isOpen={terminalOpen}
          onToggle={handleToggleTerminal}
        />
      )}
    </div>
  );
}