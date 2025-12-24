'use client';

import { useEffect, useState } from 'react';

export function SelectedInstrumentCard() {
  const [instrument, setInstrument] = useState({
    symbol: 'MNQ',
    price: 0,
    change: 0,
    changePercent: 0,
  });
  
  useEffect(() => {
    // TODO: Fetch from market API
    setInstrument({
      symbol: 'MNQ',
      price: 18523.5,
      change: 45.2,
      changePercent: 0.24,
    });
  }, []);
  
  const isPositive = instrument.change >= 0;
  
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Selected Instrument</h3>
      <div className="space-y-1">
        <p className="text-xl font-semibold">{instrument.symbol}</p>
        <p className="font-mono text-lg">{instrument.price.toFixed(2)}</p>
        <p className={`font-mono text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{instrument.change.toFixed(2)} ({isPositive ? '+' : ''}{instrument.changePercent.toFixed(2)}%)
        </p>
      </div>
    </div>
  );
}
