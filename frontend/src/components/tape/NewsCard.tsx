'use client';

import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import type { NewsItem } from '@/types';

interface NewsCardProps {
  item: NewsItem;
}

export function NewsCard({ item }: NewsCardProps) {
  const SentimentIcon = 
    item.sentiment === 'bullish' ? TrendingUp :
    item.sentiment === 'bearish' ? TrendingDown :
    Minus;
  
  const sentimentColor =
    item.sentiment === 'bullish' ? 'text-green-600' :
    item.sentiment === 'bearish' ? 'text-red-600' :
    'text-gray-500';
  
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            {item.isBreaking && (
              <Zap className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(item.time).toLocaleTimeString()} • {item.source}
            </span>
          </div>
          <h3 className="mb-2 font-semibold">{item.headline}</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <SentimentIcon className={`h-4 w-4 ${sentimentColor}`} />
              <span className="text-xs text-muted-foreground capitalize">{item.sentiment}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              IV Impact: {item.ivImpact}/10
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
