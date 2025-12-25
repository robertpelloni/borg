'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Key, Server, Bot, Plug, Activity, MessageSquare, FileText, ShoppingBag } from 'lucide-react';

export const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { href: '/secrets', label: 'API Keys', icon: Key },
    { href: '/mcp', label: 'MCP Servers', icon: Server },
    { href: '/agents', label: 'Agents & Skills', icon: Bot },
    { href: '/prompts', label: 'Prompts', icon: MessageSquare },
    { href: '/context', label: 'Context', icon: FileText },
    { href: '/hooks', label: 'Hooks', icon: Plug },
    { href: '/inspector', label: 'Traffic', icon: Activity },
  ];

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Super AI Plugin
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500">v0.7.0-rc</div>
      </div>
    </aside>
  );
};
