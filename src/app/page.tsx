// src/app/page.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletConnectButton } from '@/components/auth/WalletConnectButton';
import { MultiplierDisplay } from '@/components/game/MultiplierDisplay';
import { BettingInterface } from '@/components/game/BettingInterface';
import { CashOutButton } from '@/components/game/CashOutButton';
import { GameHistory } from '@/components/game/GameHistory';
import { useGameLogic } from '@/hooks/useGameLogic';
// import { Separator } from '@/components/ui/separator'; // No longer used

export default function CryptoCrashPage() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [userWalletAddress, setUserWalletAddress] = useState<string | undefined>();

  const {
    gameState,
    currentMultiplier,
    timer,
    crashedAt,
    betAmountInput,
    setBetAmountInput,
    balance,
    handlePlaceBet,
    isBettingActive,
    isProcessingBet,
    hasPlacedBet,
    handleCashOut,
    canCashOut,
    isProcessingCashOut,
    gameHistory,
  } = useGameLogic(userWalletAddress); // Pass wallet address to the hook

  const handleWalletConnectionChange = (connected: boolean, address?: string) => {
    setIsWalletConnected(connected);
    setUserWalletAddress(address);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-3xl space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <svg width="32" height="32" viewBox="0 0 100 100" className="text-primary">
              <path fill="currentColor" d="M50 0L61.23 23.27L87.57 26.12L67.64 43.88L73.52 69.12L50 56.62L26.48 69.12L32.36 43.88L12.43 26.12L38.77 23.27L50 0Z M50 28.87L43.09 41.23L28.87 43.09L41.23 50L43.09 64.22L50 56.91L56.91 64.22L58.77 50L71.13 43.09L56.91 41.23L50 28.87Z"/>
            </svg>
            <h1 className="text-3xl md:text-4xl font-bold text-primary font-mono tracking-tighter">
              CryptoCrash
            </h1>
          </div>
          <WalletConnectButton onConnectionChange={handleWalletConnectionChange} />
        </header>

        <Card className="bg-card text-card-foreground shadow-2xl overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <MultiplierDisplay
              gameState={gameState}
              multiplier={currentMultiplier}
              timer={timer}
              crashedAt={crashedAt}
            />
          </CardContent>
        </Card>

        {isWalletConnected ? (
          <div className="grid md:grid-cols-5 gap-6">
            <Card className="md:col-span-3 bg-card text-card-foreground shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Place Your Bet</CardTitle>
              </CardHeader>
              <CardContent>
                <BettingInterface
                  betAmount={betAmountInput}
                  setBetAmount={setBetAmountInput}
                  onPlaceBet={handlePlaceBet}
                  balance={balance}
                  gameState={gameState}
                  isBettingActive={isBettingActive}
                  isProcessingBet={isProcessingBet}
                  hasPlacedBet={hasPlacedBet}
                />
              </CardContent>
              <CardFooter>
                <CashOutButton
                  onCashOut={handleCashOut}
                  currentMultiplier={currentMultiplier}
                  gameState={gameState}
                  canCashOut={canCashOut}
                  isProcessingCashOut={isProcessingCashOut}
                />
              </CardFooter>
            </Card>
            <div className="md:col-span-2">
              <GameHistory historyItems={gameHistory} />
            </div>
          </div>
        ) : (
          <Card className="bg-card text-card-foreground shadow-xl p-8 text-center">
            <CardTitle className="text-xl mb-4">Connect Your Wallet</CardTitle>
            <p className="text-muted-foreground">
              Please connect your wallet to play CryptoCrash.
            </p>
          </Card>
        )}
         <footer className="text-center text-muted-foreground text-xs mt-8">
            <p>&copy; {new Date().getFullYear()} CryptoCrash. For entertainment purposes only. Play responsibly.</p>
            <p>This is an MVP. All currency is simulated.</p>
          </footer>
      </div>
    </main>
  );
}
