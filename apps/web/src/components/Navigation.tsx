
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-6">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    BORG
                </div>
                <div className="flex gap-4">
                    <Link
                        href="/"
                        className={`text-sm font-medium transition-colors hover:text-blue-500 ${isActive('/') ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Mission Control
                    </Link>
                    <Link
                        href="/docs"
                        className={`text-sm font-medium transition-colors hover:text-blue-500 ${isActive('/docs') ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Documentation
                    </Link>
                    <Link
                        href="/status"
                        className={`text-sm font-medium transition-colors hover:text-blue-500 ${isActive('/status') ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        System Status
                    </Link>
                    <Link
                        href="/dashboard/council"
                        className={`text-sm font-medium transition-colors hover:text-purple-500 ${isActive('/dashboard/council') ? 'text-purple-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Council
                    </Link>
                    <Link
                        href="/dashboard/skills"
                        className={`text-sm font-medium transition-colors hover:text-green-500 ${isActive('/dashboard/skills') ? 'text-green-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Skills
                    </Link>
                    <Link
                        href="/dashboard/reader"
                        className={`text-sm font-medium transition-colors hover:text-orange-500 ${isActive('/dashboard/reader') ? 'text-orange-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Reader
                    </Link>
                    <Link
                        href="/dashboard/command"
                        className={`text-sm font-medium transition-colors hover:text-red-500 ${isActive('/dashboard/command') ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Command Center
                    </Link>
                    <Link
                        href="/dashboard/inspector"
                        className={`text-sm font-medium transition-colors hover:text-yellow-500 ${isActive('/dashboard/inspector') ? 'text-yellow-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Traffic
                    </Link>
                    <Link
                        href="/dashboard/config"
                        className={`text-sm font-medium transition-colors hover:text-slate-500 ${isActive('/dashboard/config') ? 'text-slate-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                        Settings
                    </Link>
                </div>
            </div>
            <div className="text-xs text-zinc-400">
                v0.1.0-alpha
            </div>
        </nav>
    );
}
