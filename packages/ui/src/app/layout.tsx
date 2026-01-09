import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { Web3Provider } from '@/components/providers/web3-provider';
import { WalletConnect } from '@/components/wallet-connect';
import './globals.css';

import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'aios',
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
        <Web3Provider>
          <div className="flex h-screen bg-gray-900 text-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-gray-900 p-8">
              <div className="flex justify-end mb-6">
                <WalletConnect />
              </div>
              {children}
            </main>
          </div>
          <Toaster />
        </Web3Provider>
      </body>
    </html>
  );
}
