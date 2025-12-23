'use client';

import { Newspaper, Bot, TrendingUp, BookOpen, Calendar, UserCircle, Settings, LogOut } from 'lucide-react';
import type { NavSection } from '@/types';

interface NavRailProps {
  currentSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  onHover: () => void;
  onLeave: () => void;
}

const sections: { id: NavSection; icon: typeof Newspaper; label: string }[] = [
  { id: 'tape', icon: Newspaper, label: 'The Tape' },
  { id: 'price', icon: Bot, label: 'Price' },
  { id: 'riskflow', icon: TrendingUp, label: 'Risk Flow' },
  { id: 'journal', icon: BookOpen, label: 'Journal' },
  { id: 'econ', icon: Calendar, label: 'Econ Calendar' },
];

export function NavRail({ currentSection, onSectionChange, onHover, onLeave }: NavRailProps) {
  return (
    <nav
      className="flex w-16 flex-col items-center border-r border-border bg-background py-4"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex flex-col gap-4">
        {sections.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onSectionChange(id)}
            className={`flex h-12 w-12 items-center justify-center rounded transition-colors ${
              currentSection === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            title={label}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>
      
      <div className="mt-auto flex flex-col gap-4">
        <button
          className="flex h-12 w-12 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          title="Profile"
        >
          <UserCircle className="h-5 w-5" />
        </button>
        <button
          className="flex h-12 w-12 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          className="flex h-12 w-12 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
