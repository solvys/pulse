import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useBackend } from '../../lib/backend';

interface AutopilotStatusLightProps {
  compact?: boolean;
}

/**
 * Compact autopilot status indicator showing:
 * - Status light (green=enabled, red=disabled)
 * - Status text
 * - Active strategies count
 */
export function AutopilotStatusLight({ compact = false }: AutopilotStatusLightProps) {
  const backend = useBackend();
  const { tradingModels } = useSettings();
  const [algoEnabled, setAlgoEnabled] = useState<boolean>(false);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setAlgoEnabled(account.algoEnabled ?? false);
      } catch (err) {
        console.error('Failed to fetch account:', err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend]);

  // Count enabled strategies
  const enabledStrategiesCount = Object.values(tradingModels).filter(Boolean).length;
  const totalStrategies = Object.keys(tradingModels).length;

  if (compact) {
    // Ultra-compact version for tight spaces
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${algoEnabled ? 'bg-emerald-400' : 'bg-red-500'}`} />
          {algoEnabled && (
            <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
          )}
        </div>
        <span className={`text-[10px] font-medium ${algoEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
          {algoEnabled ? 'ON' : 'OFF'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Icon and status light */}
      <div className="flex items-center gap-1.5">
        <Cpu className="w-3 h-3 text-[#FFC038]" />
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${algoEnabled ? 'bg-emerald-400' : 'bg-red-500'}`} />
          {algoEnabled && (
            <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
          )}
        </div>
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className={`text-[10px] font-semibold ${algoEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
          Autopilot {algoEnabled ? 'Enabled' : 'Disabled'}
        </span>
        <span className="text-[9px] text-gray-500">
          {enabledStrategiesCount}/{totalStrategies} strategies active
        </span>
      </div>
    </div>
  );
}
