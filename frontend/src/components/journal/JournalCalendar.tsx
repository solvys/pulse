'use client';

import { useState, useEffect } from 'react';
import { DayDetailModal } from './DayDetailModal';
import { journalApi } from '@/lib/api-client';
import type { CalendarDay } from '@/types';

export function JournalCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchCalendar() {
      try {
        const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        const data = await journalApi.getCalendar(monthStr);
        setDays(data.days || []);
      } catch (error) {
        console.error('Failed to fetch calendar:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCalendar();
  }, [currentMonth]);
  
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  
  const getDayData = (day: number): CalendarDay | null => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return days.find(d => d.date === dateStr) || null;
  };
  
  const getDayColor = (dayData: CalendarDay | null): string => {
    if (!dayData || dayData.status === 'no-trades') {
      return 'bg-muted';
    }
    
    const absPnL = Math.abs(dayData.pnl);
    const cap = 1000;
    const normalized = Math.min(absPnL, cap) / cap;
    const alpha = 0.1 + normalized * 0.25;
    
    if (dayData.status === 'profitable') {
      return `bg-green-500/20 border-green-500/30`;
    } else if (dayData.status === 'loss') {
      return `bg-red-500/20 border-red-500/30`;
    }
    return 'bg-amber-500/20 border-amber-500/30';
  };
  
  if (loading) {
    return <div className="text-muted-foreground">Loading calendar...</div>;
  }
  
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {Array.from({ length: startDay }, (_, i) => (
          <div key={`empty-${i}`} className="h-16" />
        ))}
        
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayData = getDayData(day);
          const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDate(dateStr)}
              className={`h-16 rounded border ${getDayColor(dayData)} p-2 text-left transition-colors hover:opacity-80`}
            >
              <div className="text-sm font-medium">{day}</div>
              {dayData && (
                <div className="text-xs">
                  <div className={dayData.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${dayData.pnl.toFixed(0)}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
