"use client";

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
import type { GameStateType } from '@/lib/types';

interface BettingInterfaceProps {
  betAmount: string;
  setBetAmount: (value: string) => void;
  onPlaceBet: () => void;
  balance: number;
  gameState: GameStateType;
  isBettingActive: boolean; // True if betting window is open
  isProcessingBet: boolean; // True if bet placement is in progress
  hasPlacedBet: boolean; // True if a bet has been successfully placed for the current/upcoming round
}

export function BettingInterface({
  betAmount,
  setBetAmount,
  onPlaceBet,
  balance,
  gameState,
  isBettingActive,
  isProcessingBet,
  hasPlacedBet,
}: BettingInterfaceProps) {

  const canPlaceBet = isBettingActive && !isProcessingBet && !hasPlacedBet;

  const handleMaxBet = () => {
    setBetAmount(balance.toFixed(2));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Your Balance:</span>
        <span className="font-semibold text-foreground">{balance.toFixed(2)} ETH</span>
      </div>
      
      <div>
        <Label htmlFor="betAmount" className="text-sm font-medium text-muted-foreground">Bet Amount (ETH)</Label>
        <div className="flex items-center mt-1 space-x-2">
          <div className="relative flex-grow">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="number"
              id="betAmount"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="0.00"
              className="pl-10 text-lg bg-input border-border focus:ring-primary"
              disabled={!isBettingActive || hasPlacedBet || isProcessingBet}
              min="0.01" // Example minimum bet
              step="0.01"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleMaxBet} 
            disabled={!isBettingActive || hasPlacedBet || isProcessingBet || balance === 0}
            className="h-10 border-border hover:bg-accent hover:text-accent-foreground"
          >
            Max
          </Button>
        </div>
      </div>

      <Button
        onClick={onPlaceBet}
        disabled={!canPlaceBet || parseFloat(betAmount) <= 0 || parseFloat(betAmount) > balance}
        className="w-full h-12 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring"
      >
        {isProcessingBet ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : hasPlacedBet ? (
          <>
            <CheckCircle2 className="mr-2 h-5 w-5" /> Bet Placed
          </>
        ) : (
          'Place Bet'
        )}
      </Button>
      
      {gameState !== 'BETTING' && !hasPlacedBet && (
         <p className="text-xs text-center text-muted-foreground">
            Betting is currently closed. Wait for the next round.
        </p>
      )}
       {hasPlacedBet && (
         <p className="text-xs text-center text-green-400">
            Your bet is locked in! Good luck!
        </p>
      )}
    </div>
  );
}
