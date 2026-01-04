"use client";

import { useState } from "react";
import { useJules } from "@/lib/jules/provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone } from "lucide-react";
import type { Session } from "@/types/jules";

interface BroadcastDialogProps {
  sessions: Session[];
}

const TEMPLATES = [
  {
    label: "Merge & Update",
    text: "Please merge all feature branches into main. Update all submodules and merge upstream changes (including forked submodules). Resolve any issues, then update your local branch to main to ensure you are working with the latest changes. Additionally, please create or update a dashboard page (or documentation) that lists all submodules with their versions, dates, and build numbers, including a clear explanation of the project directory structure and submodule locations."
  },
  {
    label: "Reanalyze & Check Features",
    text: "Outstanding work. Please reanalyze the project state and conversation history to identify any further features that need implementation."
  },
  {
    label: "Roadmap & Documentation",
    text: "Please analyze the entire conversation history and project status. Organize every feature, package, and implementation detail into the roadmap and documentation. Clearly distinguish between what has been accomplished and what remains to be done, then proceed to the next feature."
  },
  {
    label: "Update Docs & Push",
    text: "Please update the changelog, increment the version number, and ensure the documentation and roadmap are current. Commit all changes and push to the remote repository."
  },
  {
    label: "Update, Fix & Redeploy",
    text: "Please update all submodules and merge upstream changes (including forks). Fix any new issues. Update the changelog, version number, documentation, and roadmap. Additionally, create or update a dashboard page (or documentation) listing all submodules with their versions and locations, along with an explanation of the project structure. Commit and push changes for each repository, then redeploy."
  },
  {
    label: "Super Protocol (All-in-One)",
    text: "Please execute the following protocol: 1) Merge all feature branches into main, update submodules, and merge upstream changes (including forks). 2) Reanalyze the project and history to identify missing features. 3) Comprehensively update the roadmap and documentation to reflect all progress. 4) Create or update a dashboard page (or documentation) listing all submodules with their versions and locations, including a project structure explanation. 5) Update the changelog and increment the version number. 6) Commit and push all changes to the remote repository. 7) Redeploy the application."
  }
];

export function BroadcastDialog({ sessions }: BroadcastDialogProps) {
  const { client } = useJules();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  // Use all provided sessions regardless of status, assuming the parent filters for "open" (unarchived) sessions
  const targetSessions = sessions;

  const handleSend = async () => {
    if (!client || !message.trim()) return;

    setSending(true);
    setProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetSessions.length; i++) {
      const session = targetSessions[i];
      try {
        await client.createActivity({
          sessionId: session.id,
          content: message,
          type: 'message'
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to send to session ${session.id}:`, error);
        failCount++;
      }
      setProgress(Math.round(((i + 1) / targetSessions.length) * 100));
    }

    setSending(false);
    setOpen(false);
    setMessage("");
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white" title="Broadcast to all open sessions">
          <Megaphone className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Broadcast Message</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Send a message to all {targetSessions.length} open sessions simultaneously.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-white">Template</Label>
            <Select onValueChange={(value) => setMessage(value)}>
              <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                {TEMPLATES.map((template, index) => (
                  <SelectItem key={index} value={template.text} className="focus:bg-white/10 focus:text-white cursor-pointer">
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message" className="text-white">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="bg-zinc-900 border-white/10 text-white min-h-[100px]"
            />
          </div>
          {sending && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Sending...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            onClick={handleSend} 
            disabled={sending || !message.trim() || targetSessions.length === 0}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Broadcast"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
