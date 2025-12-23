'use client';

import type { LayoutMode } from '@/types';

interface LayoutModeSelectorProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

const modes: { value: LayoutMode; label: string }[] = [
  { value: 'combined', label: 'Combined' },
  { value: 'tickers-only', label: 'Tickers Only' },
  { value: 'moveable', label: 'Moveable' },
];

export function LayoutModeSelector({ mode, onModeChange }: LayoutModeSelectorProps) {
  return (
    <select
      value={mode}
      onChange={(e) => onModeChange(e.target.value as LayoutMode)}
      className="rounded border border-border bg-background px-2 py-1 text-sm"
    >
      {modes.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
