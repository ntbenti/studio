// src/hooks/useGameLogic.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameStateType, Bet, GameHistoryItem, RoundData, UserStats } from '@/lib/types';
import { predictCrashPoint, type PredictCrashPointInput } from '@/ai/flows/crash-predictor';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, runTransaction } from 'firebase/firestore';

const BETTING_DURATION = 7; // seconds
const ROUND_END_PAUSE = 3; // seconds after crash before new round
const MULTIPLIER_INCREMENT_INTERVAL = 100; // ms
const INITIAL_MULTIPLIER_SPEED = 0.01; // per interval
const ACCELERATION_THRESHOLD = 3; // multiplier at which speed increases
const ACCELERATED_MULTIPLIER_SPEED = 0.05; // per interval after threshold
const FASTER_ACCELERATION_THRESHOLD = 10;
const FASTER_MULTIPLIER_SPEED = 0.15;

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


export function useGameLogic(walletAddress?: string) {
  const [gameState, setGameState] = useState<GameStateType>("BETTING");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [timer, setTimer] = useState(BETTING_DURATION);
  const [predictedCrashPoint, setPredictedCrashPoint] = useState<number | null>(null);
  
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [betAmountInput, setBetAmountInput] = useState<string>("");
  const [balance, setBalance] = useState(10.00); 
  
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
    setIsProcessingBet(false);
    setIsProcessingCashOut(false);
    setHasPlacedBetThisRound(false);
    setGameState("BETTING");
    setTimer(BETTING_DURATION);
  }, []);

  // Game State Machine & Stats Update
  useEffect(() => {
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);

    switch (gameState) {
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
                : 2.0,
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
        gameLoopRef.current = setTimeout(async () => {
          const finalCrashPoint = predictedCrashPoint || currentMultiplier;
          let profitThisRound = 0;
          let currentBetForHistory: Bet | undefined = undefined;
          let cashedOutSuccessfullyThisRound = false;
          let cashedOutAtMultiplierThisRound = 0;

          if (userBet && hasPlacedBetThisRound) {
            currentBetForHistory = { ...userBet };
            if (userBet.cashedOutAt && userBet.cashedOutAt <= finalCrashPoint) {
              profitThisRound = (userBet.amount * userBet.cashedOutAt) - userBet.amount;
              setBalance(prev => parseFloat((prev + (userBet.amount * userBet.cashedOutAt!)).toFixed(2)));
              cashedOutSuccessfullyThisRound = true;
              cashedOutAtMultiplierThisRound = userBet.cashedOutAt;
            } else {
              profitThisRound = -userBet.amount;
            }
          }
          
          const newHistoryItem: GameHistoryItem = {
            id: crypto.randomUUID(),
            crashPoint: finalCrashPoint,
            bet: currentBetForHistory, 
            profit: profitThisRound,
            timestamp: new Date().toISOString(),
          };
          
          setGameHistory(prev => [newHistoryItem, ...prev.slice(0, 19)]);
          setRoundHistoryForAI(prev => [{ finalMultiplier: newHistoryItem.crashPoint, timestamp: newHistoryItem.timestamp }, ...prev.slice(0,19)]);

          // Update Firestore stats
          if (walletAddress && currentBetForHistory) { // Only update if there was a bet
            const userStatsRef = doc(db, 'users', walletAddress);
            try {
              await runTransaction(db, async (transaction) => {
                const userStatsSnap = await transaction.get(userStatsRef);
                let currentStats: UserStats;

                if (!userStatsSnap.exists()) {
                  // This case should ideally be handled by WalletConnectButton creating the doc.
                  // If it still happens, initialize with default and apply this round's data.
                  console.warn(`User doc ${walletAddress} not found, creating.`);
                  currentStats = { ...defaultUserStats, lastPlayed: new Date().toISOString()};
                } else {
                  currentStats = userStatsSnap.data() as UserStats;
                }
                
                const updatedGamesPlayed = currentStats.gamesPlayed + 1;
                const updatedTotalWagered = currentStats.totalWagered + currentBetForHistory.amount;
                
                let updatedTotalWon = currentStats.totalWon;
                let updatedSuccessfulCashouts = currentStats.successfulCashouts;
                let updatedTotalCashedOutMultiplierValue = currentStats.totalCashedOutMultiplierValue;

                if (cashedOutSuccessfullyThisRound) {
                  updatedTotalWon += currentBetForHistory.amount * cashedOutAtMultiplierThisRound;
                  updatedSuccessfulCashouts += 1;
                  updatedTotalCashedOutMultiplierValue += cashedOutAtMultiplierThisRound;
                }
                
                const updatedNetProfit = updatedTotalWon - updatedTotalWagered;
                const updatedAvgCashoutMultiplier = updatedSuccessfulCashouts > 0 
                  ? updatedTotalCashedOutMultiplierValue / updatedSuccessfulCashouts 
                  : 0;

                const newStats: UserStats = {
                  gamesPlayed: updatedGamesPlayed,
                  totalWagered: updatedTotalWagered,
                  totalWon: updatedTotalWon,
                  netProfit: updatedNetProfit,
                  successfulCashouts: updatedSuccessfulCashouts,
                  totalCashedOutMultiplierValue: updatedTotalCashedOutMultiplierValue,
                  avgCashoutMultiplier: parseFloat(updatedAvgCashoutMultiplier.toFixed(2)),
                  lastPlayed: new Date().toISOString(),
                };
                transaction.set(userStatsRef, newStats); // Use set to create if not exists or update if exists
              });
            } catch (error) {
              console.error("Error updating user stats in transaction:", error);
              toast({ title: "Stats Error", description: "Could not update player statistics.", variant: "destructive"});
            }
          }
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
  }, [gameState, timer, userBet, predictedCrashPoint, currentMultiplier, resetForNewRound, roundHistoryForAI, toast, gameHistory, hasPlacedBetThisRound, walletAddress]);

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
      toast({ title: "Cashed Out!", description: `You secured ${currentMultiplier.toFixed(2)}x! Winnings: ${winnings.toFixed(2)} ETH (Profit: ${profit.toFixed(2)} ETH).`});
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
