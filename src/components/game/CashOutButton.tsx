"use client";

import { Button } from '@/components/ui/button';
import { TrendingUp, Loader2 } from 'lucide-react';
import type { GameStateType } from '@/lib/types';

interface CashOutButtonProps {
  onCashOut: () => void;
  currentMultiplier: number;
  gameState: GameStateType;
  canCashOut: boolean; // True if a bet is active and round is running
  isProcessingCashOut: boolean; // True if cash out is in progress
}

export function CashOutButton({
  onCashOut,
  currentMultiplier,
  gameState,
  canCashOut,
  isProcessingCashOut,
}: CashOutButtonProps) {
  const isButtonActive = canCashOut && gameState === 'RUNNING' && !isProcessingCashOut;

  return (
    <Button
      onClick={onCashOut}
      disabled={!isButtonActive}
      className="w-full h-12 text-lg font-semibold bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-ring"
      aria-live="polite"
    >
      {isProcessingCashOut ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <TrendingUp className="mr-2 h-5 w-5" />
      )}
      {isButtonActive ? `Cash Out @ ${currentMultiplier.toFixed(2)}x` : 'Cash Out'}
    </Button>
  );
}
