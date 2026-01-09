'use client';

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';

export function WalletConnect() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
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

  return (
    <Button 
      variant="outline" 
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isConnecting}
      className="gap-2"
    >
      {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      Connect Wallet
    </Button>
  );
}
