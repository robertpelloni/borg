
import CommandCenter from "@/components/CommandCenter";

export default function CommandPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-8 text-white">Command Center (Jarvis)</h1>
            <div className="max-w-5xl mx-auto">
                <CommandCenter />
            </div>
        </div>
    );
}
