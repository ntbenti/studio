"use client";

import type { GameHistoryItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GameHistoryProps {
  historyItems: GameHistoryItem[];
}

export function GameHistory({ historyItems }: GameHistoryProps) {
  if (historyItems.length === 0) {
    return (
      <Card className="bg-card text-card-foreground shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl">Game History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No games played yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl">Game History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3 pr-4">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 rounded-md bg-card-foreground/5 hover:bg-card-foreground/10 transition-colors"
              >
                <div className="flex flex-col">
                   <span className={cn(
                      "font-semibold text-lg",
                      item.crashPoint < 1.5 && "text-destructive",
                      item.crashPoint >= 1.5 && item.crashPoint < 5 && "text-yellow-500",
                      item.crashPoint >= 5 && "text-primary"
                    )}>
                    {item.crashPoint.toFixed(2)}x
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                {item.bet && (
                  <div className="text-right">
                    {item.bet.cashedOutAt ? (
                       <Badge variant="default" className="bg-primary text-primary-foreground">
                        Cashed out @ {item.bet.cashedOutAt.toFixed(2)}x
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Crashed</Badge>
                    )}
                    {item.profit !== undefined && (
                       <p className={cn(
                          "text-sm font-medium mt-1",
                          item.profit > 0 && "text-primary",
                          item.profit < 0 && "text-destructive",
                          item.profit === 0 && "text-muted-foreground"
                        )}>
                        {item.profit > 0 ? '+' : ''}{item.profit.toFixed(2)} ETH
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
