import ConnectionStatus from "../components/ConnectionStatus";
import IndexingStatus from "../components/IndexingStatus";
import RemoteAccessCard from "../components/RemoteAccessCard";
import ConfigEditor from "../components/ConfigEditor";
import { TraceViewer } from "../components/TraceViewer";
import { CommandRunner } from "../components/CommandRunner";
import { AutonomyControl } from "../components/AutonomyControl";
import { DirectorChat } from "../components/DirectorChat";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black py-12">
      <main className="flex flex-col items-center gap-8 w-full max-w-4xl px-4">
        <h1 className="text-4xl font-bold">Borg Mission Control</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <ConnectionStatus />
          <RemoteAccessCard />
        </div>
        <AutonomyControl />
        <DirectorChat />
        <IndexingStatus />
        <ConfigEditor />
        <CommandRunner />
        <TraceViewer />
      </main>
    </div>
  );
}
