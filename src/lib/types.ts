export type GameStateType =
  | "IDLE"          // Waiting for the next round to start betting
  | "BETTING"       // Betting window is open
  | "STARTING_ROUND"// Bets are locked, round is about to start
  | "RUNNING"       // Multiplier is increasing
  | "CRASHED"       // Multiplier has crashed
  | "ENDED";        // Round results processed, preparing for IDLE

export interface Bet {
  amount: number;
  cashedOutAt?: number; // Multiplier at which user cashed out
}

export interface GameHistoryItem {
  id: string;
  crashPoint: number;
  bet?: Bet; // User's bet for this round
  profit?: number;
  timestamp: string;
}

export interface RoundData {
  finalMultiplier: number;
  timestamp: string;
}
