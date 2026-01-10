import { createPublicClient, createWalletClient, http, formatEther, parseEther, type PublicClient, type WalletClient, type Chain, type Account } from 'viem';
import { mainnet, sepolia, polygon, arbitrum, optimism, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { EventEmitter } from 'events';

type SupportedChain = 'mainnet' | 'sepolia' | 'polygon' | 'arbitrum' | 'optimism' | 'base';

const CHAINS: Record<SupportedChain, Chain> = {
  mainnet,
  sepolia,
  polygon,
  arbitrum,
  optimism,
  base
};

export interface WalletState {
  address: string | null;
  chainId: number;
  chainName: string;
  isConnected: boolean;
  balance: string;
}

export class WalletManager extends EventEmitter {
  private static instance: WalletManager;
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private account: Account | null = null;
  private connectedAddress: string | null = null;
  private currentChain: SupportedChain = 'mainnet';

  private constructor() {
    super();
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http()
    });
  }

  public static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  public switchChain(chainName: SupportedChain): void {
    const chain = CHAINS[chainName];
    if (!chain) throw new Error(`Unsupported chain: ${chainName}`);
    
    this.currentChain = chainName;
    this.publicClient = createPublicClient({
      chain,
      transport: http()
    });
    
    this.emit('chainChanged', { chainId: chain.id, chainName });
  }

  public connect(address: string): void {
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error('Invalid address format');
    }
    this.connectedAddress = address;
    this.emit('connected', { address });
  }

  public connectWithPrivateKey(privateKey: string): void {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    this.account = account;
    this.connectedAddress = account.address;
    
    this.walletClient = createWalletClient({
      account,
      chain: CHAINS[this.currentChain],
      transport: http()
    });
    
    this.emit('connected', { address: account.address, canSign: true });
  }

  public disconnect(): void {
    this.connectedAddress = null;
    this.walletClient = null;
    this.emit('disconnected');
  }

  public getConnectedAddress(): string | null {
    return this.connectedAddress;
  }

  public async getBalance(address?: string): Promise<string> {
    const targetAddress = address || this.connectedAddress;
    
    if (!targetAddress) {
      throw new Error('No address provided and no wallet connected');
    }

    const balance = await this.publicClient.getBalance({ 
      address: targetAddress as `0x${string}` 
    });
    
    return formatEther(balance);
  }

  public async getState(): Promise<WalletState> {
    const chain = CHAINS[this.currentChain];
    let balance = '0';
    
    if (this.connectedAddress) {
      try {
        balance = await this.getBalance();
      } catch {}
    }

    return {
      address: this.connectedAddress,
      chainId: chain.id,
      chainName: this.currentChain,
      isConnected: !!this.connectedAddress,
      balance
    };
  }

  public async sendTransaction(to: string, value: string): Promise<string> {
    if (!this.walletClient || !this.account) {
      throw new Error('Wallet not connected with signing capability');
    }

    const hash = await this.walletClient.sendTransaction({
      account: this.account,
      chain: CHAINS[this.currentChain],
      to: to as `0x${string}`,
      value: parseEther(value)
    });

    this.emit('transaction', { hash, to, value });
    return hash;
  }

  public async signMessage(message: string): Promise<string> {
    if (!this.walletClient || !this.account) {
      throw new Error('Wallet not connected with signing capability');
    }

    const signature = await this.walletClient.signMessage({
      account: this.account,
      message
    });

    return signature;
  }

  public getSupportedChains(): string[] {
    return Object.keys(CHAINS);
  }

  public canSign(): boolean {
    return !!this.walletClient;
  }
}
