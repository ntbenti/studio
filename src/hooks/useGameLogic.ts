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
              setPredictedCrashPoint(Math.random() * 9 + 1.1); // Random between 1.1 and 10.1 to avoid extreme highs
               toast({ title: "AI Warning", description: "AI prediction was invalid, using fallback.", variant: "destructive" });
            }
            // console.log("AI Predicted Crash Point:", predictionResult.predictedCrashPoint, "Reasoning:", predictionResult.reasoning);
            setGameState("RUNNING");
          } catch (error) {
            console.error("Error fetching crash prediction:", error);
            // Fallback to a random crash point if AI fails
            setPredictedCrashPoint(Math.random() * 9 + 1.1); // Random between 1.1 and 10.1
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
          const finalCrashPoint = predictedCrashPoint || currentMultiplier;
          const newHistoryItem: GameHistoryItem = {
            id: crypto.randomUUID(),
            crashPoint: finalCrashPoint,
            bet: userBet ? { ...userBet } : undefined, // Store a copy of the bet state for history
            profit: 0,
            timestamp: new Date().toISOString(),
          };

          if (userBet) {
            if (userBet.cashedOutAt && userBet.cashedOutAt <= finalCrashPoint) { // User cashed out successfully
              newHistoryItem.profit = userBet.amount * userBet.cashedOutAt - userBet.amount;
              // Balance was already reduced by userBet.amount when bet was placed.
              // Add the full payout (stake + profit).
              setBalance(prev => prev + (userBet.amount * userBet.cashedOutAt!));
            } else { // User didn't cash out or cashed out too late (should not happen if UI disables cashout post-crash)
              newHistoryItem.profit = -userBet.amount;
              // Balance already reflects the loss of the stake. No further adjustment needed.
            }
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
    // Simulate API call for betting
    setTimeout(() => {
      setUserBet({ amount }); // Set userBet without cashedOutAt initially
      setBalance(prev => prev - amount); // Deduct bet amount from balance
      setHasPlacedBetThisRound(true);
      setIsProcessingBet(false);
      toast({ title: "Bet Placed", description: `You wagered ${amount.toFixed(2)} ETH.` });
    }, 750);
  }, [gameState, betAmountInput, balance, hasPlacedBetThisRound, isProcessingBet, toast]);

  const handleCashOut = useCallback(() => {
    if (gameState !== "RUNNING" || !userBet || userBet.cashedOutAt || isProcessingCashOut) return;

    setIsProcessingCashOut(true);
    // Simulate API call for cashing out
    setTimeout(() => {
      const cashedOutBet: Bet = { ...userBet, cashedOutAt: currentMultiplier };
      setUserBet(cashedOutBet); // Update userBet to include cashedOutAt
      
      const profit = cashedOutBet.amount * currentMultiplier - cashedOutBet.amount;
      
      setIsProcessingCashOut(false);
      toast({ title: "Cashed Out!", description: `You secured ${currentMultiplier.toFixed(2)}x! Winnings: ${ (cashedOutBet.amount * currentMultiplier).toFixed(2)} ETH (Profit: ${profit.toFixed(2)} ETH).`});
      // Balance update will happen at round end (CRASHED state) to centralize logic and use final crash point for history.
    }, 500);
  }, [gameState, userBet, currentMultiplier, isProcessingCashOut, toast]);

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
    canCashOut: !!userBet && !userBet.cashedOutAt && gameState === "RUNNING" && !isProcessingCashOut,
    isProcessingCashOut,
    
    gameHistory,
  };
}
