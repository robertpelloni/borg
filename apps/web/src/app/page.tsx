import ConnectionStatus from "../components/ConnectionStatus";
import IndexingStatus from "../components/IndexingStatus";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
        <h1 className="text-4xl font-bold">AIOS Mission Control</h1>
        <ConnectionStatus />
        <IndexingStatus />
      </main>
    </div>
  );
}
