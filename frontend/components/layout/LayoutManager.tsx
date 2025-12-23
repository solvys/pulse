'use client';

import { useAppShell } from '@/hooks/useAppShell';
import type { NavSection } from '@/types';

interface LayoutManagerProps {
  currentSection: NavSection;
  children: React.ReactNode;
}

export function LayoutManager({
  currentSection,
  children,
}: LayoutManagerProps) {
  const { layoutMode, topStepXEnabled } = useAppShell();
  if (layoutMode === 'tickers-only') {
    return (
      <div className="flex-1 overflow-hidden">
        {topStepXEnabled ? (
          <div className="relative h-full w-full">
            <iframe
              src="https://app.topstepx.com"
              className="h-full w-full border-0"
              title="TopStepX"
            />
            {/* Floating widgets would go here */}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            {children}
          </div>
        )}
      </div>
    );
  }
  
  if (layoutMode === 'combined') {
    return (
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Mission Control / RiskFlow tools */}
        <div className="w-64 border-r border-border bg-muted/30">
          <div className="p-4">
            <h3 className="text-sm font-semibold">Mission Control</h3>
          </div>
        </div>
        
        {/* Main Center */}
        <div className="flex-1 overflow-hidden">
          {topStepXEnabled ? (
            <iframe
              src="https://app.topstepx.com"
              className="h-full w-full border-0"
              title="TopStepX"
            />
          ) : (
            <div className="h-full overflow-auto">{children}</div>
          )}
        </div>
        
        {/* Right Panel - Tape */}
        {currentSection === 'tape' && (
          <div className="w-80 border-l border-border bg-muted/30">
            <div className="h-full overflow-auto p-4">{children}</div>
          </div>
        )}
      </div>
    );
  }
  
  // Moveable mode
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-64 border-r border-border bg-muted/30">
        <div className="p-4">
          <h3 className="text-sm font-semibold">Panel A</h3>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
      <div className="w-64 border-l border-border bg-muted/30">
        <div className="p-4">
          <h3 className="text-sm font-semibold">Panel B</h3>
        </div>
      </div>
    </div>
  );
}
