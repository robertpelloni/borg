'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia, polygon, arbitrum, optimism, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID - get yours at https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

const config = createConfig({
  chains: [mainnet, sepolia, polygon, arbitrum, optimism, base],
  connectors: [
    injected(),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'AIOS Dashboard',
        description: 'AI Operating System - Bobcoin Wallet',
        url: 'https://aios.local',
        icons: ['https://aios.local/icon.png'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes (previously cacheTime)
    },
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config };
