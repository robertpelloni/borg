import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CouncilDashboard() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest">Autopilot Council</h2>
            <p className="text-sm text-white/60">Manage local OpenCode sessions and transient repositories.</p>
          </div>
          <Button className="bg-purple-600 hover:bg-purple-500 text-white font-mono uppercase tracking-widest text-xs">
            <Plus className="mr-2 h-4 w-4" />
            New Local Session
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Placeholder for local sessions */}
          <Card className="bg-zinc-900 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Local Session #1</CardTitle>
              <CardDescription className="text-white/40">/path/to/local/repo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-green-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Active
              </div>
            </CardContent>
          </Card>
          
           <Card className="bg-zinc-900 border-white/10 border-dashed flex flex-col items-center justify-center min-h-[150px] cursor-pointer hover:bg-zinc-900/50 transition-colors">
            <div className="text-white/20 font-mono text-xs uppercase tracking-widest">No Active Sessions</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
