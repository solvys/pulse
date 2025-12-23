'use client';

import { useEffect, useState } from 'react';

export function VIXTicker() {
  const [vix, setVix] = useState({ value: 0, change: 0, changePercent: 0 });
  
  useEffect(() => {
    // TODO: Fetch from market API
    setVix({ value: 15.23, change: 0.45, changePercent: 3.05 });
  }, []);
  
  const isPositive = vix.change >= 0;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">VIX:</span>
      <span className="font-mono font-medium">{vix.value.toFixed(2)}</span>
      <span className={`font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{vix.change.toFixed(2)} ({isPositive ? '+' : ''}{vix.changePercent.toFixed(2)}%)
      </span>
    </div>
  );
}
