'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { LayoutMode, NavSection } from '@/types';

interface AppShellContextType {
  currentSection: NavSection;
  setCurrentSection: (section: NavSection) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  topStepXEnabled: boolean;
  setTopStepXEnabled: (enabled: boolean) => void;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [currentSection, setCurrentSection] = useState<NavSection>('tape');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('combined');
  const [topStepXEnabled, setTopStepXEnabled] = useState(false);
  
  return (
    <AppShellContext.Provider
      value={{
        currentSection,
        setCurrentSection,
        layoutMode,
        setLayoutMode,
        topStepXEnabled,
        setTopStepXEnabled,
      }}
    >
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return context;
}
