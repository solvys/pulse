'use client';

import { useEffect, useState } from 'react';
import { marketApi } from '@/lib/api-client';

export function VIXTicker() {
  const [vix, setVix] = useState({ value: 0, change: 0, changePercent: 0 });
  const [prevValue, setPrevValue] = useState<number | null>(null);
  
  useEffect(() => {
    async function fetchVIX() {
      try {
        const data = await marketApi.getVIX();
        const currentValue = data.value;
        
        if (prevValue !== null) {
          const change = currentValue - prevValue;
          const changePercent = (change / prevValue) * 100;
          setVix({ value: currentValue, change, changePercent });
        } else {
          setVix({ value: currentValue, change: 0, changePercent: 0 });
        }
        
        setPrevValue(currentValue);
      } catch (error) {
        console.error('Failed to fetch VIX:', error);
        // Fallback to default value
        setVix({ value: 15.0, change: 0, changePercent: 0 });
      }
    }
    
    fetchVIX();
    const interval = setInterval(fetchVIX, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [prevValue]);
  
  const isPositive = vix.change >= 0;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">VIX:</span>
      <span className="font-mono font-medium">{vix.value.toFixed(2)}</span>
      {vix.change !== 0 && (
        <span className={`font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{vix.change.toFixed(2)} ({isPositive ? '+' : ''}{vix.changePercent.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}
