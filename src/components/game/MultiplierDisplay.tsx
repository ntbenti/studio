"use client";

import { cn } from '@/lib/utils';
import type { GameStateType } from '@/lib/types';

interface MultiplierDisplayProps {
  gameState: GameStateType;
  multiplier: number;
  timer: number; // For countdowns
  crashedAt: number | null; // Multiplier value at crash
}

export function MultiplierDisplay({ gameState, multiplier, timer, crashedAt }: MultiplierDisplayProps) {
  let displayText: string | number = "";
  let textColorClass = "text-foreground"; // Default text color (white on dark theme)

  switch (gameState) {
    case "IDLE":
      displayText = `Next round in ${timer}s`;
      textColorClass = "text-muted-foreground";
      break;
    case "BETTING":
      displayText = `Betting closes in ${timer}s`;
      textColorClass = "text-accent"; // Use accent for betting phase
      break;
    case "STARTING_ROUND":
      displayText = "Starting round...";
      textColorClass = "text-muted-foreground";
      break;
    case "RUNNING":
      displayText = `${multiplier.toFixed(2)}x`;
      textColorClass = "text-primary"; // Use primary (electric green) for running multiplier
      break;
    case "CRASHED":
    case "ENDED":
      displayText = `CRASHED @ ${crashedAt ? crashedAt.toFixed(2) : '0.00'}x`;
      textColorClass = "text-destructive"; // Use destructive color for crash
      break;
    default:
      displayText = "Loading...";
      textColorClass = "text-muted-foreground";
  }

  const isNumericDisplay = gameState === "RUNNING" || gameState === "CRASHED" || gameState === "ENDED";

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-40 md:h-48 rounded-lg shadow-inner",
      "bg-card-foreground/5" // Slightly inset look
    )}>
      <div
        className={cn(
          "font-mono font-bold transition-colors duration-300",
          textColorClass,
          isNumericDisplay ? "text-7xl md:text-8xl lg:text-9xl" : "text-3xl md:text-4xl"
        )}
      >
        {displayText}
      </div>
    </div>
  );
}
