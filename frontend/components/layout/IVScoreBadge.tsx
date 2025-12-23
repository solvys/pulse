'use client';

import { useEffect, useState } from 'react';

export function IVScoreBadge() {
  const [score, setScore] = useState(0);
  
  useEffect(() => {
    // TODO: Fetch from IV scoring API
    setScore(7.5);
  }, []);
  
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted px-2 py-1">
      <span className="text-xs text-muted-foreground">IV:</span>
      <span className="font-mono text-sm font-semibold">{score.toFixed(1)}</span>
    </div>
  );
}
