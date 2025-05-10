"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameStateType, Bet, GameHistoryItem, RoundData } from '@/lib/types';
import { predictCrashPoint, type PredictCrashPointInput } from '@/ai/flows/crash-predictor';
import { useToast } from '@/hooks/use-toast';

const IDLE_DURATION = 5; // seconds before betting starts
const BETTING_DURATION = 7; // seconds
const ROUND_END_PAUSE = 3; // seconds after crash before new round
const MULTIPLIER_INCREMENT_INTERVAL = 100; // ms
const INITIAL_MULTIPLIER_SPEED = 0.01; // per interval
const ACCELERATION_THRESHOLD = 3; // multiplier at which speed increases
const ACCELERATED_MULTIPLIER_SPEED = 0.05; // per interval after threshold
const FASTER_ACCELERATION_THRESHOLD = 10;
const FASTER_MULTIPLIER_SPEED = 0.15;


export function useGameLogic() {
  const [gameState, setGameState] = useState<GameStateType>("IDLE");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [timer, setTimer] = useState(IDLE_DURATION);
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
    setGameState("IDLE");
    setTimer(IDLE_DURATION);
  }, []);

  // Game State Machine
  useEffect(() => {
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);

    switch (gameState) {
      case "IDLE":
        if (timer > 0) {
          gameLoopRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
        } else {
          setGameState("BETTING");
          setTimer(BETTING_DURATION);
        }
        break;
      case "BETTING":
        if (timer > 0) {
          gameLoopRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
        } else {
          setGameState("STARTING_ROUND");
        }
        break;
      case "STARTING_ROUND":
        // Fetch prediction from AI
        const fetchPrediction = async () => {
          try {
            // Mock AI input for now
            const aiInput: PredictCrashPointInput = {
              roundHistory: roundHistoryForAI.slice(-10), // Last 10 rounds
              currentPot: (userBet?.amount || 0) * 5, // Mock pot based on user bet
              averageCashoutMultiplier: 1.5, // Mock average
            };
            const predictionResult = await predictCrashPoint(aiInput);
            if (predictionResult.predictedCrashPoint > 1.0) {
              setPredictedCrashPoint(predictionResult.predictedCrashPoint);
            } else {
              // Fallback if AI gives invalid prediction
              setPredictedCrashPoint(Math.random() * 10 + 1.1); // Random between 1.1 and 11.1
               toast({ title: "AI Warning", description: "AI prediction was invalid, using fallback.", variant: "destructive" });
            }
            setGameState("RUNNING");
          } catch (error) {
            console.error("Error fetching crash prediction:", error);
            // Fallback to a random crash point if AI fails
            setPredictedCrashPoint(Math.random() * 10 + 1.1);
            setGameState("RUNNING");
            toast({ title: "AI Error", description: "Could not get AI prediction, using fallback.", variant: "destructive" });
          }
        };
        fetchPrediction();
        break;
      case "RUNNING":
        // Multiplier increase is handled in its own useEffect
        break;
      case "CRASHED":
        gameLoopRef.current = setTimeout(() => {
          // Process round results
          const newHistoryItem: GameHistoryItem = {
            id: crypto.randomUUID(),
            crashPoint: predictedCrashPoint || currentMultiplier,
            bet: userBet || undefined,
            profit: 0,
            timestamp: new Date().toISOString(),
          };

          if (userBet) {
            if (userBet.cashedOutAt) { // User cashed out
              newHistoryItem.profit = userBet.amount * userBet.cashedOutAt - userBet.amount;
            } else { // User didn't cash out and crashed
              newHistoryItem.profit = -userBet.amount;
            }
            setBalance(prev => prev + (newHistoryItem.profit || 0));
          }
          
          setGameHistory(prev => [newHistoryItem, ...prev.slice(0, 19)]);
          setRoundHistoryForAI(prev => [{ finalMultiplier: newHistoryItem.crashPoint, timestamp: newHistoryItem.timestamp }, ...prev.slice(0,19)]);
          setGameState("ENDED");
        }, 1000); // Brief pause to show "CRASHED"
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
  }, [gameState, timer, userBet, predictedCrashPoint, currentMultiplier, resetForNewRound, roundHistoryForAI, toast]);

  // Multiplier Increase Logic
  useEffect(() => {
    if (gameState === "RUNNING" && predictedCrashPoint) {
      if (multiplierIntervalRef.current) clearInterval(multiplierIntervalRef.current);
      
      multiplierIntervalRef.current = setInterval(() => {
        setCurrentMultiplier(prevMultiplier => {
          if (prevMultiplier >= predictedCrashPoint) {
            if (multiplierIntervalRef.current) clearInterval(multiplierIntervalRef.current);
            setGameState("CRASHED");
            return predictedCrashPoint; // Cap at crash point
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
    if (gameState !== "BETTING" || hasPlacedBetThisRound) return;
    
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
    // Simulate API call for betting
    setTimeout(() => {
      setUserBet({ amount });
      setBalance(prev => prev - amount);
      setHasPlacedBetThisRound(true);
      setIsProcessingBet(false);
      toast({ title: "Bet Placed", description: `You wagered ${amount.toFixed(2)} ETH.` });
    }, 750);
  }, [gameState, betAmountInput, balance, hasPlacedBetThisRound, toast]);

  const handleCashOut = useCallback(() => {
    if (gameState !== "RUNNING" || !userBet || userBet.cashedOutAt || isProcessingCashOut) return;

    setIsProcessingCashOut(true);
    // Simulate API call for cashing out
    setTimeout(() => {
      const cashedOutBet: Bet = { ...userBet, cashedOutAt: currentMultiplier };
      setUserBet(cashedOutBet);
      // Profit is calculated at round end, but we can show an immediate toast
      const profit = cashedOutBet.amount * currentMultiplier - cashedOutBet.amount;
      // Balance update will happen at round end to simplify state logic
      // setBalance(prev => prev + cashedOutBet.amount * currentMultiplier); // This would be profit + original bet
      
      setIsProcessingCashOut(false);
      toast({ title: "Cashed Out!", description: `You secured ${currentMultiplier.toFixed(2)}x for a profit of ${profit.toFixed(2)} ETH (excluding stake).`});
    }, 500);
  }, [gameState, userBet, currentMultiplier, isProcessingCashOut, toast]);

  return {
    gameState,
    currentMultiplier,
    timer,
    crashedAt: gameState === "CRASHED" || gameState === "ENDED" ? predictedCrashPoint : null,
    
    betAmountInput,
    setBetAmountInput,
    balance,
    handlePlaceBet,
    isBettingActive: gameState === "BETTING",
    isProcessingBet,
    hasPlacedBet: hasPlacedBetThisRound,
    
    handleCashOut,
    canCashOut: !!userBet && !userBet.cashedOutAt && gameState === "RUNNING",
    isProcessingCashOut,
    
    gameHistory,
  };
}
