'use client';

import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Wallet, LogOut, ChevronDown, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  11155111: 'Sepolia',
  137: 'Polygon',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
};

export function WalletConnect() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const chainId = useChainId();
  const { switchChain, chains } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1 font-medium">
              {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Switch Network</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {chains.map((chain) => (
              <DropdownMenuItem
                key={chain.id}
                onClick={() => switchChain({ chainId: chain.id })}
                className={chainId === chain.id ? 'bg-accent' : ''}
              >
                {chain.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Badge variant="outline" className="h-9 px-3 gap-2 font-mono">
          {balance ? formatUnits(balance.value, balance.decimals).slice(0, 6) : '0.00'} {balance?.symbol}
        </Badge>
        <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 pr-3 border">
          <div className="h-7 w-7 rounded bg-gradient-to-br from-blue-500 to-purple-500" />
          <span className="text-sm font-medium font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-1 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => disconnect()}
          >
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  const injectedConnector = connectors.find(c => c.id === 'injected');
  const walletConnectConnector = connectors.find(c => c.id === 'walletConnect');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isConnecting || isPending} className="gap-2">
          {isConnecting || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          Connect Wallet
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Connect with</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {injectedConnector && (
          <DropdownMenuItem onClick={() => connect({ connector: injectedConnector })}>
            <Wallet className="h-4 w-4 mr-2" />
            Browser Wallet
          </DropdownMenuItem>
        )}
        {walletConnectConnector && (
          <DropdownMenuItem onClick={() => connect({ connector: walletConnectConnector })}>
            <Link2 className="h-4 w-4 mr-2" />
            WalletConnect
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
