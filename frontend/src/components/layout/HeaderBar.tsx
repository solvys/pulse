'use client';

import { VIXTicker } from './VIXTicker';
import { TopStepXTogglePill } from './TopStepXTogglePill';
import { LayoutModeSelector } from './LayoutModeSelector';
import { IVScoreBadge } from './IVScoreBadge';
import { useUser } from '@clerk/clerk-react';
import { useAppShell } from '@/hooks/useAppShell';

export function HeaderBar() {
  const { user } = useUser();
  const { layoutMode, setLayoutMode, topStepXEnabled, setTopStepXEnabled } = useAppShell();
  
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        {/* LogoSlot - placeholder for GIF */}
        <div className="h-8 w-8 bg-muted" />
        
        {/* User Tier */}
        <span className="text-sm font-medium text-muted-foreground">
          {(user?.publicMetadata?.tier as string) || 'Standard'}
        </span>
        
        {/* TopStepX Toggle */}
        <TopStepXTogglePill
          enabled={topStepXEnabled}
          onToggle={setTopStepXEnabled}
        />
      </div>
      
      <div className="flex items-center gap-4">
        {/* VIX Ticker */}
        <VIXTicker />
        
        {/* Layout Mode Selector */}
        <LayoutModeSelector
          mode={layoutMode}
          onModeChange={setLayoutMode}
        />
        
        {/* IV Score Badge */}
        <IVScoreBadge />
      </div>
    </header>
  );
}
