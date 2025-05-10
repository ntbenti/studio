
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameStateType, Bet, GameHistoryItem, RoundData } from '@/lib/types';
import { predictCrashPoint, type PredictCrashPointInput } from '@/ai/flows/crash-predictor';
import { useToast } from '@/hooks/use-toast';

const BETTING_DURATION = 7; // seconds
const ROUND_END_PAUSE = 3; // seconds after crash before new round
const MULTIPLIER_INCREMENT_INTERVAL = 100; // ms
const INITIAL_MULTIPLIER_SPEED = 0.01; // per interval
const ACCELERATION_THRESHOLD = 3; // multiplier at which speed increases
const ACCELERATED_MULTIPLIER_SPEED = 0.05; // per interval after threshold
const FASTER_ACCELERATION_THRESHOLD = 10;
const FASTER_MULTIPLIER_SPEED = 0.15;


export function useGameLogic() {
  const [gameState, setGameState] = useState<GameStateType>("BETTING"); // Initialize directly to BETTING
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [timer, setTimer] = useState(BETTING_DURATION); // Initialize timer for BETTING state
  const [predictedCrashPoint, setPredictedCrashPoint] = useState<number | null>(null);
  
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [betAmountInput, setBetAmountInput] = useState<string>("");
  const [balance, setBalance] = useState(10.00); // Mock balance
  
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [roundHistoryForAI, setRoundHistoryForAI] = useState<RoundData[]>([]);

  const [isProcessingBet, setIsProcessingBet] = useState(false);
  const [isProcessingCashOut, setIsProcessingCashOut] = useState(false);
  const [hasPlacedBetThisRound, setHasPlacedBetThisRound] = useState(false);

  const { toast } = useToast();
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const multiplierIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetForNewRound = useCallback(() => {
    setCurrentMultiplier(1.0);
    setPredictedCrashPoint(null);
    setUserBet(null);
    // betAmountInput is kept for user convenience
    setIsProcessingBet(false);
    setIsProcessingCashOut(false);
    setHasPlacedBetThisRound(false);
    setGameState("BETTING"); // Go directly to betting
    setTimer(BETTING_DURATION); // Set timer for betting
  }, []);

  // Game State Machine
  useEffect(() => {
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);

    switch (gameState) {
      // IDLE state removed
      case "BETTING":
        if (timer > 0) {
          gameLoopRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
        } else {
          setGameState("STARTING_ROUND");
        }
        break;
      case "STARTING_ROUND":
        const fetchPrediction = async () => {
          try {
            const aiInput: PredictCrashPointInput = {
              roundHistory: roundHistoryForAI.slice(-10), 
              currentPot: (userBet?.amount || 0) * 5, 
              averageCashoutMultiplier: gameHistory.length > 0 
                ? gameHistory.reduce((acc, item) => acc + item.crashPoint, 0) / gameHistory.length 
                : 2.0, // Default if no history
            };
            const predictionResult = await predictCrashPoint(aiInput);
            if (predictionResult.predictedCrashPoint > 1.0) {
              setPredictedCrashPoint(predictionResult.predictedCrashPoint);
            } else {
              const fallbackCrashPoint = parseFloat((Math.random() * 9 + 1.1).toFixed(2));
              setPredictedCrashPoint(fallbackCrashPoint); 
               toast({ title: "AI Warning", description: `AI prediction was invalid (${predictionResult.predictedCrashPoint.toFixed(2)}x), using fallback (${fallbackCrashPoint}x). Reason: ${predictionResult.reasoning}`, variant: "destructive", duration: 7000 });
            }
            setGameState("RUNNING");
          } catch (error) {
            console.error("Error fetching crash prediction:", error);
            const fallbackCrashPoint = parseFloat((Math.random() * 9 + 1.1).toFixed(2));
            setPredictedCrashPoint(fallbackCrashPoint); 
            setGameState("RUNNING");
            toast({ title: "AI Error", description: `Could not get AI prediction, using fallback (${fallbackCrashPoint}x).`, variant: "destructive" });
          }
        };
        fetchPrediction();
        break;
      case "RUNNING":
        // Multiplier increase is handled in its own useEffect
        break;
      case "CRASHED":
        gameLoopRef.current = setTimeout(() => {
          const finalCrashPoint = predictedCrashPoint || currentMultiplier; // Should always be predictedCrashPoint
          
          let profit = 0;
          let currentBetForHistory: Bet | undefined = undefined;

          if (userBet && hasPlacedBetThisRound) { // Ensure bet was for the current round
            currentBetForHistory = { ...userBet }; // Copy for history
            if (userBet.cashedOutAt && userBet.cashedOutAt <= finalCrashPoint) { 
              // User cashed out successfully
              profit = (userBet.amount * userBet.cashedOutAt) - userBet.amount;
              // Balance was already reduced at bet placement. Add the full payout.
              setBalance(prev => parseFloat((prev + (userBet.amount * userBet.cashedOutAt!)).toFixed(2)));
            } else { 
              // User didn't cash out or cashed out too late / bet lost
              profit = -userBet.amount;
              // Balance already reflects the loss of the stake. No further adjustment needed.
            }
          }
          
          const newHistoryItem: GameHistoryItem = {
            id: crypto.randomUUID(),
            crashPoint: finalCrashPoint,
            bet: currentBetForHistory, 
            profit: profit,
            timestamp: new Date().toISOString(),
          };
          
          setGameHistory(prev => [newHistoryItem, ...prev.slice(0, 19)]);
          setRoundHistoryForAI(prev => [{ finalMultiplier: newHistoryItem.crashPoint, timestamp: newHistoryItem.timestamp }, ...prev.slice(0,19)]);
          setGameState("ENDED");
        }, 1000); 
        break;
      case "ENDED":
        gameLoopRef.current = setTimeout(() => {
          resetForNewRound();
        }, ROUND_END_PAUSE * 1000);
        break;
    }
    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [gameState, timer, userBet, predictedCrashPoint, currentMultiplier, resetForNewRound, roundHistoryForAI, toast, gameHistory, hasPlacedBetThisRound]);

  // Multiplier Increase Logic
  useEffect(() => {
    if (gameState === "RUNNING" && predictedCrashPoint) {
      if (multiplierIntervalRef.current) clearInterval(multiplierIntervalRef.current);
      
      multiplierIntervalRef.current = setInterval(() => {
        setCurrentMultiplier(prevMultiplier => {
          if (prevMultiplier >= predictedCrashPoint) {
            if (multiplierIntervalRef.current) clearInterval(multiplierIntervalRef.current);
            setGameState("CRASHED");
            return predictedCrashPoint; 
          }
          let speed = INITIAL_MULTIPLIER_SPEED;
          if (prevMultiplier >= FASTER_ACCELERATION_THRESHOLD) {
            speed = FASTER_MULTIPLIER_SPEED;
          } else if (prevMultiplier >= ACCELERATION_THRESHOLD) {
            speed = ACCELERATED_MULTIPLIER_SPEED;
          }
          return parseFloat((prevMultiplier + speed).toFixed(2));
        });
      }, MULTIPLIER_INCREMENT_INTERVAL);
    } else {
      if (multiplierIntervalRef.current) clearInterval(multiplierIntervalRef.current);
    }
    return () => {
      if (multiplierIntervalRef.current) clearInterval(multiplierIntervalRef.current);
    };
  }, [gameState, predictedCrashPoint]);

  const handlePlaceBet = useCallback(() => {
    if (gameState !== "BETTING" || hasPlacedBetThisRound || isProcessingBet) return;
    
    const amount = parseFloat(betAmountInput);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Bet", description: "Please enter a valid bet amount.", variant: "destructive" });
      return;
    }
    if (amount > balance) {
      toast({ title: "Insufficient Balance", description: "You do not have enough funds.", variant: "destructive" });
      return;
    }

    setIsProcessingBet(true);
    setTimeout(() => {
      setUserBet({ amount }); 
      setBalance(prev => parseFloat((prev - amount).toFixed(2))); 
      setHasPlacedBetThisRound(true);
      setIsProcessingBet(false);
      toast({ title: "Bet Placed", description: `You wagered ${amount.toFixed(2)} ETH.` });
    }, 750);
  }, [gameState, betAmountInput, balance, hasPlacedBetThisRound, isProcessingBet, toast]);

  const handleCashOut = useCallback(() => {
    if (gameState !== "RUNNING" || !userBet || userBet.cashedOutAt || isProcessingCashOut || !hasPlacedBetThisRound) return;

    setIsProcessingCashOut(true);
    setTimeout(() => {
      const cashedOutBet: Bet = { ...userBet, cashedOutAt: currentMultiplier };
      setUserBet(cashedOutBet); 
      
      const winnings = parseFloat((cashedOutBet.amount * currentMultiplier).toFixed(2));
      const profit = parseFloat((winnings - cashedOutBet.amount).toFixed(2));
      
      setIsProcessingCashOut(false);
      toast({ title: "Cashed Out!", description: `You secured ${currentMultiplier.toFixed(2)}x! Winnings: ${winnings} ETH (Profit: ${profit} ETH).`});
    }, 500);
  }, [gameState, userBet, currentMultiplier, isProcessingCashOut, toast, hasPlacedBetThisRound]);

  return {
    gameState,
    currentMultiplier,
    timer,
    crashedAt: gameState === "CRASHED" || gameState === "ENDED" ? (predictedCrashPoint || currentMultiplier) : null,
    
    betAmountInput,
    setBetAmountInput,
    balance,
    handlePlaceBet,
    isBettingActive: gameState === "BETTING" && !hasPlacedBetThisRound,
    isProcessingBet,
    hasPlacedBet: hasPlacedBetThisRound,
    
    handleCashOut,
    canCashOut: !!userBet && !userBet.cashedOutAt && gameState === "RUNNING" && !isProcessingCashOut && hasPlacedBetThisRound,
    isProcessingCashOut,
    
    gameHistory,
  };
}

