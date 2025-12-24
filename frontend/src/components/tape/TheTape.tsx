'use client';

import { useEffect, useState } from 'react';
import { NewsCard } from './NewsCard';
import { newsApi } from '@/lib/api-client';
import type { NewsItem } from '@/types';

export function TheTape() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchNews() {
      try {
        const data = await newsApi.getFeed();
        setNews(data.items || []);
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchNews();
  }, []);
  
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading news feed...</p>
      </div>
    );
  }
  
  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <h1 className="mb-4 text-2xl font-semibold">The Tape</h1>
      <div className="space-y-4">
        {news.length === 0 ? (
          <p className="text-muted-foreground">No news items available</p>
        ) : (
          news.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
