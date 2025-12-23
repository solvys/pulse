'use client';

import { useState } from 'react';
import { AppShellProvider } from '@/hooks/useAppShell';
import { HeaderBar } from './HeaderBar';
import { NavRail } from '../navigation/NavRail';
import { NavSidebar } from '../navigation/NavSidebar';
import { LayoutManager } from './LayoutManager';
import { useAppShell } from '@/hooks/useAppShell';
import type { NavSection } from '@/types';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { currentSection, setCurrentSection } = useAppShell();
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarPeek, setSidebarPeek] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <HeaderBar />
      
      <div className="flex flex-1 overflow-hidden">
        <NavRail
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
          onHover={() => setSidebarPeek(true)}
          onLeave={() => !sidebarPinned && setSidebarPeek(false)}
        />
        
        <NavSidebar
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
          isPinned={sidebarPinned}
          isPeek={sidebarPeek}
          onPin={() => {
            setSidebarPinned(true);
            setSidebarPeek(true);
          }}
          onClose={() => {
            setSidebarPinned(false);
            setSidebarPeek(false);
          }}
        />
        
        <LayoutManager currentSection={currentSection}>
          {children}
        </LayoutManager>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppShellProvider>
  );
}
