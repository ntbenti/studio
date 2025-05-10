"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WalletConnectButtonProps {
  onConnectionChange?: (isConnected: boolean, address?: string) => void;
}

export function WalletConnectButton({ onConnectionChange }: WalletConnectButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { toast } = useToast();

  // Simulate checking connection status on mount
  useEffect(() => {
    const storedAddress = localStorage.getItem('walletAddress');
    if (storedAddress) {
      setIsConnected(true);
      setWalletAddress(storedAddress);
      if (onConnectionChange) onConnectionChange(true, storedAddress);
    } else {
       if (onConnectionChange) onConnectionChange(false);
    }
  }, [onConnectionChange]);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    setWalletAddress(newAddress);
    setIsConnected(true);
    setIsConnecting(false);
    localStorage.setItem('walletAddress', newAddress);
    if (onConnectionChange) onConnectionChange(true, newAddress);
    toast({
      title: "Wallet Connected",
      description: `Address: ${newAddress.substring(0, 6)}...${newAddress.substring(newAddress.length - 4)}`,
    });
  };

  const handleDisconnect = () => {
    setIsConnecting(true);
    // Simulate disconnection
    setTimeout(() => {
      setWalletAddress(null);
      setIsConnected(false);
      setIsConnecting(false);
      localStorage.removeItem('walletAddress');
      if (onConnectionChange) onConnectionChange(false);
      toast({
        title: "Wallet Disconnected",
      });
    }, 500);
  };

  if (isConnected) {
    return (
      <Button variant="outline" onClick={handleDisconnect} disabled={isConnecting} className="text-sm">
        {isConnecting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="mr-2 h-4 w-4" />
        )}
        Disconnect {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : ''}
      </Button>
    );
  }

  return (
    <Button onClick={handleConnect} disabled={isConnecting} className="text-sm bg-primary hover:bg-primary/90 text-primary-foreground">
      {isConnecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wallet className="mr-2 h-4 w-4" />
      )}
      Connect Wallet
    </Button>
  );
}
