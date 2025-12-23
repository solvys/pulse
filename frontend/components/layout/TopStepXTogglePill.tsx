'use client';

interface TopStepXTogglePillProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TopStepXTogglePill({ enabled, onToggle }: TopStepXTogglePillProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        enabled
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      TopStepX {enabled ? 'ON' : 'OFF'}
    </button>
  );
}
