import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { UpgradeModal } from '../UpgradeModal';
import { IVScoreCard } from '../IVScoreCard';
import { useBackend } from '../../lib/backend';
import { isElectron } from '../../lib/platform';
import { LayoutGrid, GripVertical, Layers, ChevronDown, Monitor } from 'lucide-react';

type LayoutOption = 'movable' | 'tickers-only' | 'combined';

function PulseLogo() {
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <img 
        src="/pulse-logo.png" 
        alt="Pulse Logo" 
        className="w-10 h-10 object-contain"
      />
    </div>
  );
}

interface TopHeaderProps {
  topStepXEnabled?: boolean;
  onTopStepXToggle?: () => void;
  layoutOption?: LayoutOption;
  onLayoutOptionChange?: (option: LayoutOption) => void;
}

export function TopHeader({ 
  topStepXEnabled = false, 
  onTopStepXToggle,
  layoutOption = 'movable',
  onLayoutOptionChange
}: TopHeaderProps) {
  const { tier } = useAuth();
  const backend = useBackend();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [ivScore, setIvScore] = useState(3.2);
  const [vix, setVix] = useState(20);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLayoutDropdown(false);
      }
    };

    if (showLayoutDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLayoutDropdown]);

  const layoutOptions: Array<{ value: LayoutOption; label: string; description: string; icon: React.ReactNode }> = [
    {
      value: 'movable',
      label: 'Movable Panels',
      description: 'Mission Control and Tape can be moved independently',
      icon: <LayoutGrid className="w-4 h-4" />
    },
    {
      value: 'tickers-only',
      label: 'Tickers Only',
      description: 'TopStepX with minimal floating widget (IV tickers only)',
      icon: <GripVertical className="w-4 h-4" />
    },
    {
      value: 'combined',
      label: 'Combined Panels',
      description: 'Both panels stacked on the right in one collapsible panel',
      icon: <Layers className="w-4 h-4" />
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIvScore(prev => Math.max(0, Math.min(10, prev + (Math.random() - 0.5) * 0.5)));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch VIX value - update every 5 minutes
  useEffect(() => {
    const fetchVIX = async () => {
      try {
        // Use the proper endpoint through the news client
        const newsClient = (backend as any).news;
        const baseClient = (newsClient as any).baseClient;
        const response = await baseClient.callTypedAPI('/news/fetch-vix', { method: 'GET', body: undefined });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[VIX] API error: ${response.status} - ${errorText}`);
          return;
        }
        
        const data = await response.json();
        if (data && typeof data.value === 'number') {
          console.log(`[VIX] Successfully fetched: ${data.value}`);
          setVix(data.value);
        } else {
          console.error('[VIX] Invalid response format:', data);
        }
      } catch (error) {
        console.error('[VIX] Failed to fetch VIX:', error);
        // Keep current value on error
      }
    };

    fetchVIX();
    const interval = setInterval(fetchVIX, 300000); // Update every 5 minutes (300000ms)
    return () => clearInterval(interval);
  }, [backend]);

  const getTierDisplayName = () => {
    switch (tier) {
      case 'free': return 'Free';
      case 'pulse': return 'Pulse';
      case 'pulse_plus': return 'Pulse+';
      case 'pulse_pro': return 'Pulse Pro';
      default: return 'Free';
    }
  };

  return (
    <div className={`bg-[#0a0a00] border-b border-[#FFC038]/20 flex items-center justify-between px-6 ${topStepXEnabled && layoutOption === 'tickers-only' ? 'h-[65px]' : 'h-[70px]'}`}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <PulseLogo />
          <button
            onClick={() => setShowUpgrade(true)}
            className="relative bg-[#050500] border border-[#FFC038]/20 rounded-lg px-3 py-1 hover:bg-[#FFC038]/10 hover:border-[#FFC038]/40 transition-colors cursor-pointer flex items-center"
          >
            <span className="text-[13px] text-gray-300">{getTierDisplayName()}</span>
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#050500] border border-zinc-800 rounded-lg px-2.5 py-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-500">VIX</span>
              <span className="text-xs font-mono text-gray-300">
                {vix.toFixed(2)}
              </span>
            </div>
          </div>
          {onTopStepXToggle && (
            isElectron() ? (
              <button
                onClick={onTopStepXToggle}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  topStepXEnabled
                    ? 'bg-[#FFC038] text-black hover:bg-[#FFC038]/90'
                    : 'bg-[#050500] border border-[#FFC038]/20 text-[#FFC038] hover:bg-[#FFC038]/10 hover:border-[#FFC038]/40'
                }`}
                title="Toggle TopStepX"
              >
                TopStepX
              </button>
            ) : (
              <button
                onClick={onTopStepXToggle}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#050500] border border-zinc-700 text-gray-400 hover:bg-zinc-900 hover:text-gray-300 transition-colors flex items-center gap-1.5"
                title="TopStepX - Opens in browser (Desktop app required for embedded view)"
              >
                <Monitor className="w-3 h-3" />
                TopStepX
              </button>
            )
          )}
          {topStepXEnabled && onLayoutOptionChange && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#050500] border border-[#FFC038]/20 text-[#FFC038] hover:bg-[#FFC038]/10 hover:border-[#FFC038]/40 transition-colors flex items-center gap-1.5"
                title="Layout Options"
              >
                {layoutOptions.find(opt => opt.value === layoutOption)?.icon}
                <span>{layoutOptions.find(opt => opt.value === layoutOption)?.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showLayoutDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showLayoutDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-[#0a0a00] border border-[#FFC038]/20 rounded-lg shadow-xl z-50 overflow-hidden">
                  {layoutOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onLayoutOptionChange(option.value);
                        setShowLayoutDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-[#FFC038]/10 transition-colors flex items-start gap-3 ${
                        layoutOption === option.value ? 'bg-[#FFC038]/20' : ''
                      }`}
                    >
                      <div className="mt-0.5 text-[#FFC038]">
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#FFC038] mb-1">
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-400">
                          {option.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <IVScoreCard score={ivScore} layoutOption={layoutOption} />
        </div>
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
