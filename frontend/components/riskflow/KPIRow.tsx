'use client';

import { useEffect, useState } from 'react';
import { SelectedInstrumentCard } from './SelectedInstrumentCard';
import { KPIGraphCard } from './KPIGraphCard';
import { NewsPlanCard } from './NewsPlanCard';
import { econApi } from '@/lib/api-client';

export function KPIRow() {
  const [newsPlan, setNewsPlan] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchNewsPlan() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const data = await econApi.getDay(today);
        setNewsPlan(data.plan || null);
      } catch (error) {
        console.error('Failed to fetch news plan:', error);
      }
    }
    
    fetchNewsPlan();
  }, []);
  
  return (
    <div className="grid grid-cols-4 gap-4">
      <SelectedInstrumentCard />
      <KPIGraphCard title="KPI 1" />
      <KPIGraphCard title="KPI 2" />
      <NewsPlanCard plan={newsPlan} />
    </div>
  );
}
