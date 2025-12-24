'use client';

import { useState, useEffect } from 'react';
import { econApi } from '@/lib/api-client';
import type { EconPlan } from '@/types';

export function EconCalendarPage() {
  const [focusIframe, setFocusIframe] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [plan, setPlan] = useState<EconPlan | null>(null);
  
  const handleInterpret = async () => {
    setInterpreting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const region = 'US';
      
      await econApi.interpret(today, timezone, region);
      
      // Fetch the cached plan
      const planData = await econApi.getDay(today);
      setPlan(planData);
    } catch (error) {
      console.error('Failed to interpret calendar:', error);
    } finally {
      setInterpreting(false);
    }
  };
  
  useEffect(() => {
    async function fetchTodayPlan() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const planData = await econApi.getDay(today);
        setPlan(planData);
      } catch (error) {
        // No plan yet, that's okay
      }
    }
    
    fetchTodayPlan();
  }, []);
  
  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">Econ Calendar</h1>
      
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFocusIframe(!focusIframe)}
            className="rounded border border-border bg-background px-3 py-1 text-sm hover:bg-muted"
          >
            {focusIframe ? 'Unfocus iframe' : 'Focus iframe'}
          </button>
          <button
            onClick={handleInterpret}
            disabled={interpreting}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {interpreting ? 'Interpreting...' : 'Interpret Today'}
          </button>
        </div>
      </div>
      
      <div className={`grid gap-4 ${focusIframe ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {!focusIframe && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {/* Simple calendar grid - non-clickable as per spec */}
              {Array.from({ length: 35 }, (_, i) => (
                <div key={i} className="h-8 rounded border border-border bg-muted/30" />
              ))}
            </div>
          </div>
        )}
        
        <div className={`rounded-lg border border-border bg-card ${focusIframe ? 'h-[80vh]' : 'h-[600px]'}`}>
          <iframe
            src="https://www.tradingview.com/economic-calendar/?region=US"
            className="h-full w-full rounded-lg"
            title="TradingView Economic Calendar"
          />
        </div>
      </div>
      
      {plan && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold">Daily Macro Plan</h2>
          <p className="mb-4 text-sm leading-relaxed">{plan.plan}</p>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Events</h3>
            <ul className="space-y-2">
              {plan.events.map((event, i) => (
                <li key={i} className="flex items-center gap-4 text-sm">
                  <span className="font-mono text-xs">{event.time}</span>
                  <span className="text-xs text-muted-foreground">{event.currency}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    event.impact === 'high' ? 'bg-red-100 text-red-800' :
                    event.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.impact}
                  </span>
                  <span>{event.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
