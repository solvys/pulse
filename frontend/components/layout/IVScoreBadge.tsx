'use client';

import { useEffect, useState } from 'react';
import { ivScoringApi } from '@/lib/api-client';

export function IVScoreBadge() {
  const [score, setScore] = useState(0);
  const [symbol, setSymbol] = useState('MNQ'); // Default symbol, could be made configurable
  
  useEffect(() => {
    async function fetchIVScore() {
      try {
        const data = await ivScoringApi.calculate(symbol);
        setScore(data.ivScore);
      } catch (error) {
        console.error('Failed to fetch IV score:', error);
        // Fallback to default score
        setScore(5.0);
      }
    }
    
    fetchIVScore();
    const interval = setInterval(fetchIVScore, 300000); // Update every 5 minutes
    
    return () => clearInterval(interval);
  }, [symbol]);
  
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted px-2 py-1">
      <span className="text-xs text-muted-foreground">IV:</span>
      <span className="font-mono text-sm font-semibold">{score.toFixed(1)}</span>
    </div>
  );
}
