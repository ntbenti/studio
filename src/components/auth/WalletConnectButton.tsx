// src/components/auth/WalletConnectButton.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserStats } from '@/lib/types';

const defaultUserStats: UserStats = {
  gamesPlayed: 0,
  totalWagered: 0,
  totalWon: 0,
  netProfit: 0,
  successfulCashouts: 0,
  totalCashedOutMultiplierValue: 0,
  avgCashoutMultiplier: 0,
  lastPlayed: new Date().toISOString(),
};

interface WalletConnectButtonProps {
  onConnectionChange?: (isConnected: boolean, address?: string) => void;
}

export function WalletConnectButton({ onConnectionChange }: WalletConnectButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { toast } = useToast();

  const initOrFetchUserStats = async (address: string) => {
    const userDocRef = doc(db, 'users', address);
    try {
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, { ...defaultUserStats, lastPlayed: new Date().toISOString() });
        toast({
          title: "Welcome!",
          description: "Your player profile has been created.",
        });
      } else {
        // Optionally, you could update lastPlayed here or fetch stats to display
        // For now, just ensuring it exists is enough
      }
    } catch (error) {
      console.error("Error initializing user stats:", error);
      toast({
        title: "Firestore Error",
        description: "Could not initialize user statistics.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const storedAddress = localStorage.getItem('walletAddress');
    if (storedAddress) {
      setIsConnected(true);
      setWalletAddress(storedAddress);
      if (onConnectionChange) onConnectionChange(true, storedAddress);
      // No need to call initOrFetchUserStats here as it's done on connect,
      // and we don't want to spam Firestore reads on every page load.
      // If stats are needed immediately, they should be fetched elsewhere.
    } else {
       if (onConnectionChange) onConnectionChange(false);
    }
  }, [onConnectionChange]);

  const handleConnect = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate wallet connection
    const newAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    await initOrFetchUserStats(newAddress);

    setWalletAddress(newAddress);
    setIsConnected(true);
    localStorage.setItem('walletAddress', newAddress);
    if (onConnectionChange) onConnectionChange(true, newAddress);
    
    setIsConnecting(false);
    toast({
      title: "Wallet Connected",
      description: `Address: ${newAddress.substring(0, 6)}...${newAddress.substring(newAddress.length - 4)}`,
    });
  };

  const handleDisconnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setWalletAddress(null);
      setIsConnected(false);
      localStorage.removeItem('walletAddress');
      if (onConnectionChange) onConnectionChange(false);
      setIsConnecting(false);
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
