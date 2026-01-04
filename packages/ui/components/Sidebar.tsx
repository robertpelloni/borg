'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Activity, Box, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Agents', href: '/agents', icon: Activity },
  { name: 'Council', href: '/council', icon: Terminal },
  { name: 'MCP Servers', href: '/mcp', icon: Box },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className='flex h-full w-64 flex-col bg-gray-900 border-r border-gray-800'>
      <div className='flex h-16 items-center px-6'>
        <h1 className='text-xl font-bold text-white'>AIOS</h1>
      </div>
      <nav className='flex-1 space-y-1 px-3 py-4'>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}