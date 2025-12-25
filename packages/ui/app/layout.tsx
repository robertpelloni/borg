import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Super AI Plugin',
  description: 'The Ultimate Meta-Orchestrator for the Model Context Protocol',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen bg-gray-900 text-gray-100">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-gray-900 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
