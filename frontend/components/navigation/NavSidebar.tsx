'use client';

import { Newspaper, Bot, TrendingUp, BookOpen, Calendar, UserCircle, Settings, LogOut, Pin, X } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import type { NavSection } from '@/types';

interface NavSidebarProps {
  currentSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  isPinned: boolean;
  isPeek: boolean;
  onPin: () => void;
  onClose: () => void;
}

const sections: { id: NavSection; icon: typeof Newspaper; label: string }[] = [
  { id: 'tape', icon: Newspaper, label: 'The Tape' },
  { id: 'price', icon: Bot, label: 'Price' },
  { id: 'riskflow', icon: TrendingUp, label: 'Risk Flow' },
  { id: 'journal', icon: BookOpen, label: 'Journal' },
  { id: 'econ', icon: Calendar, label: 'Econ Calendar' },
];

export function NavSidebar({
  currentSection,
  onSectionChange,
  isPinned,
  isPeek,
  onPin,
  onClose,
}: NavSidebarProps) {
  const { user } = useUser();
  
  if (!isPeek && !isPinned) return null;
  
  return (
    <div
      className={`absolute left-16 z-50 h-full w-64 border-r border-border bg-background shadow-lg transition-transform ${
        isPeek || isPinned ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-sm font-semibold">Navigation</h2>
          <div className="flex gap-2">
            {!isPinned && (
              <button
                onClick={onPin}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                title="Pin sidebar"
              >
                <Pin className="h-4 w-4" />
              </button>
            )}
            {isPinned && (
              <button
                onClick={onClose}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                title="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <nav className="flex-1 space-y-2 py-4">
          {sections.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors ${
                currentSection === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>
        
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{user?.fullName || user?.emailAddresses[0]?.emailAddress}</span>
          </div>
          <button className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-foreground hover:bg-muted">
            <Settings className="h-5 w-5" />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-foreground hover:bg-muted">
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
