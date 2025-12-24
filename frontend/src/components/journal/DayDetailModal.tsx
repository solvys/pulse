'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { journalApi, erApi } from '@/lib/api-client';
import type { DayDetail, ERData } from '@/types';

interface DayDetailModalProps {
  date: string;
  onClose: () => void;
}

export function DayDetailModal({ date, onClose }: DayDetailModalProps) {
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [erData, setErData] = useState<ERData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      try {
        const [detail, er] = await Promise.all([
          journalApi.getDateDetail(date),
          erApi.getByDate(date),
        ]);
        setDayDetail(detail);
        setErData(er);
      } catch (error) {
        console.error('Failed to fetch day detail:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [date]);
  
  const pnlChartData = dayDetail?.pnlByTime.map(({ hour, pnl }) => ({
    hour,
    pnl,
  })) || [];
  
  const erChartData = erData?.erByTime.map(({ hour, score }) => ({
    hour,
    score,
  })) || [];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl font-semibold">
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4">
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-lg font-semibold">
                  Net P&L: <span className={dayDetail?.netPnL && dayDetail.netPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${dayDetail?.netPnL.toFixed(2) || '0.00'}
                  </span>
                </p>
              </div>
              
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">P&L by Time</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pnlChartData}>
                        <defs>
                          <linearGradient id="gradient-pnl" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Area
                          type="monotone"
                          dataKey="pnl"
                          stroke="#3b82f6"
                          fill="url(#gradient-pnl)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Emotional Resonance by Time</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={erChartData}>
                        <defs>
                          <linearGradient id="gradient-er" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="hour" />
                        <YAxis domain={[0, 10]} />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#8b5cf6"
                          fill="url(#gradient-er)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Order History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">Symbol</th>
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">Side</th>
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">Size</th>
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">Entry</th>
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">Exit</th>
                        <th className="p-2 text-left text-xs font-medium text-muted-foreground">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayDetail?.orders.map((order) => (
                        <tr key={order.id} className="border-b border-border">
                          <td className="p-2 text-xs">{new Date(order.time).toLocaleTimeString()}</td>
                          <td className="p-2 text-xs font-mono">{order.symbol}</td>
                          <td className="p-2 text-xs capitalize">{order.side}</td>
                          <td className="p-2 text-xs">{order.size}</td>
                          <td className="p-2 text-xs font-mono">{order.entryPrice.toFixed(2)}</td>
                          <td className="p-2 text-xs font-mono">{order.exitPrice.toFixed(2)}</td>
                          <td className={`p-2 text-xs font-mono ${order.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${order.pnl.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <button
                onClick={() => {
                  // TODO: Navigate to Price chat with context
                  console.log('Chat with Price about this day', date);
                }}
                className="w-full rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Chat with Price about this day
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
