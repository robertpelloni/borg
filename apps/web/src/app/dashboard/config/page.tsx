
'use client';
import DirectorConfig from "@/components/DirectorConfig";

export default function ConfigPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-8 text-white">System Configuration</h1>
            <div className="max-w-4xl mx-auto">
                <DirectorConfig />
            </div>
        </div>
    );
}
