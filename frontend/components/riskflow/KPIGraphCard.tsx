'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface KPIGraphCardProps {
  title: string;
}

export function KPIGraphCard({ title }: KPIGraphCardProps) {
  // Mock data - replace with real data
  const data = Array.from({ length: 24 }, (_, i) => ({
    time: i,
    value: Math.random() * 100,
  }));
  
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              fill={`url(#gradient-${title})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
