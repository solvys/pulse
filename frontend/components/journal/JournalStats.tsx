'use client';

import { useEffect, useState } from 'react';
import { journalApi } from '@/lib/api-client';
import type { JournalStats as JournalStatsType } from '@/types';

export function JournalStats() {
  const [stats, setStats] = useState<JournalStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await journalApi.getStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch journal stats:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, []);
  
  if (loading) {
    return <div className="text-muted-foreground">Loading stats...</div>;
  }
  
  if (!stats) {
    return <div className="text-muted-foreground">No stats available</div>;
  }
  
  return (
    <div className="grid grid-cols-6 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Win Rate</p>
        <p className="text-2xl font-semibold">{stats.winRate}%</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Avg P&L</p>
        <p className="text-2xl font-semibold">${stats.avgPnL.toFixed(2)}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Trades</p>
        <p className="text-2xl font-semibold">{stats.totalTrades}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Profit Factor</p>
        <p className="text-2xl font-semibold">{stats.profitFactor.toFixed(2)}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Best Trade</p>
        <p className="text-2xl font-semibold text-green-600">${stats.bestTrade.toFixed(2)}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Worst Trade</p>
        <p className="text-2xl font-semibold text-red-600">${stats.worstTrade.toFixed(2)}</p>
      </div>
    </div>
  );
}
