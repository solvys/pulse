import { useSettings } from '../../contexts/SettingsContext';
import { useState, useEffect } from 'react';
import { useBackend } from '../../lib/backend';
import { TestTradeButton } from './TestTradeButton';
import type { ProjectXAccount } from '../../../types/api';
type BrokerAccount = ProjectXAccount & { provider?: string; isPaper?: boolean };
import { Radio } from 'lucide-react';

interface AccountTrackerWidgetProps {
  currentPnL?: number;
}

export function AccountTrackerWidget({ currentPnL: propPnL }: AccountTrackerWidgetProps) {
  const backend = useBackend();
  const { riskSettings, developerSettings } = useSettings();
  const { dailyProfitTarget, dailyLossLimit } = riskSettings;
  const [balance, setBalance] = useState<number>(0);
  const [dailyTarget, setDailyTarget] = useState<number>(dailyProfitTarget);
  const [lossLimit, setLossLimit] = useState<number>(dailyLossLimit);
  const [currentPnL, setCurrentPnL] = useState<number>(propPnL ?? 0);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [showAccountDropdown, setShowAccountDropdown] = useState<boolean>(false);
  const [projectxAccounts, setProjectxAccounts] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uplinked, setUplinked] = useState<boolean>(false);
  const [uplinking, setUplinking] = useState<boolean>(false);
  const [uplinkMessage, setUplinkMessage] = useState<string>('');

  useEffect(() => {
    const fetchProjectXAccounts = async () => {
      try {
        const result = await backend.projectx.listAccounts();
        setProjectxAccounts(result.accounts as BrokerAccount[]);
        if (result.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(result.accounts[0].accountId);
        }
      } catch (err) {
        console.error('Failed to fetch ProjectX accounts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjectXAccounts();
  }, []);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setBalance(account.balance);
        setDailyTarget(account.dailyTarget || dailyProfitTarget);
        setLossLimit(account.dailyLossLimit || dailyLossLimit);
        // Always use dailyPnl from backend, not prop (prop is for backward compatibility)
        setCurrentPnL(account.dailyPnl);
      } catch (err) {
        console.error('Failed to fetch account:', err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend, dailyProfitTarget, dailyLossLimit]);

  const handleUplink = async () => {
    setUplinking(true);
    setUplinkMessage('');
    try {
      const result = await backend.projectx.uplinkProjectX();
      if (result.success) {
        setUplinked(true);
        setUplinkMessage(result.message);
        
        const accountsResult = await backend.projectx.listAccounts();
        setProjectxAccounts(accountsResult.accounts as BrokerAccount[]);
        if (accountsResult.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(accountsResult.accounts[0].accountId);
        }
        
        const account = await backend.account.get();
        setBalance(account.balance);
        setCurrentPnL(account.dailyPnl);
      } else {
        setUplinkMessage(result.message);
      }
    } catch (err: any) {
      console.error('Failed to uplink:', err);
      if (err?.message?.includes('credentials') || err?.message?.includes('ProjectX')) {
        setUplinkMessage(err.message);
      } else if (err?.code === 'unauthenticated') {
        setUplinkMessage('Authentication error - please refresh the page');
      } else {
        setUplinkMessage('Failed to establish uplink - check console for details');
      }
    } finally {
      setUplinking(false);
      setTimeout(() => setUplinkMessage(''), 5000);
    }
  };

  const maxRange = Math.max(dailyTarget, lossLimit);
  const normalizedPosition = (currentPnL / maxRange) * 50;
  const clampedPosition = Math.max(-50, Math.min(50, normalizedPosition));
  const leftPercentage = 50 + clampedPosition;

  const getPendulumColor = () => {
    if (currentPnL >= dailyTarget) return 'bg-[#FFC038]';
    if (currentPnL <= -lossLimit) return 'bg-red-500';
    if (currentPnL > 0) return 'bg-emerald-400';
    return 'bg-red-400';
  };

  return (
    <div className="bg-[#050500] border border-[#FFC038]/20 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-[#FFC038]">Account Tracker</h3>
          {uplinked && (
            <div className="relative">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
            </div>
          )}
        </div>
      </div>
      
      {/* Account chooser dropdown in its own row */}
      <div className="mb-1.5">
        <div className="relative">
          {projectxAccounts.length > 0 ? (
            <>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-full px-2 py-1 rounded bg-[#0a0a00] border border-[#FFC038]/30 text-[10px] text-[#FFC038] hover:bg-[#FFC038]/10 transition-colors text-left"
              >
                {projectxAccounts.find(a => a.accountId === selectedAccount)?.accountName || 'Select Account'}
              </button>
              {showAccountDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#0a0a00] border border-[#FFC038]/30 rounded shadow-lg z-10 min-w-[180px]">
                  {projectxAccounts.map(account => (
                    <button
                      key={account.accountId}
                      onClick={() => {
                        setSelectedAccount(account.accountId);
                        setShowAccountDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#FFC038]/10 transition-colors ${
                        selectedAccount === account.accountId ? 'text-[#FFC038]' : 'text-gray-400'
                      }`}
                    >
                      <div className="font-medium">{account.accountName}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {account.provider} • {account.isPaper ? 'Paper' : 'Live'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full px-2 py-1 text-[10px] text-gray-500 text-center">
              {loading ? 'Loading...' : 'No accounts'}
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-2">
        <button
          onClick={handleUplink}
          disabled={uplinking || uplinked}
          className={`w-full px-2 py-1.5 rounded font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            uplinked
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-[#FFC038] hover:bg-[#FFC038]/90 text-black border border-[#FFC038]'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Radio className={`w-3 h-3 ${uplinked ? 'animate-pulse' : ''}`} />
          {uplinking ? 'Establishing Uplink...' : uplinked ? 'Uplink Active' : 'Uplink'}
        </button>
        {uplinkMessage && (
          <p className={`text-[10px] mt-1 text-center ${
            uplinked ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {uplinkMessage}
          </p>
        )}
      </div>
      
      <div className="mb-2 flex justify-between items-baseline">
        <div>
          <p className="text-[10px] text-gray-500">Balance</p>
          <p className="text-sm font-bold text-[#FFC038]">${balance.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500">Current P&L</p>
          <span className={`text-sm font-bold ${currentPnL >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
            {currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div className="relative">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span className="text-red-500">-${lossLimit}</span>
          <span className="text-gray-400">$0</span>
          <span className="text-emerald-400">+${dailyTarget}</span>
        </div>
        
        <div className="relative h-3 bg-zinc-900 rounded-full overflow-hidden">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600 z-0" />
          
          <div
            className="absolute top-0 bottom-0 w-0.5 rounded-full z-10 transition-all duration-500"
            style={{ left: `${leftPercentage}%` }}
          >
            <div className={`w-full h-full ${getPendulumColor()} rounded-full shadow-lg`} />
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 ${getPendulumColor()} rounded-full border border-[#0a0a00]`} />
          </div>
          
          <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-gradient-to-r from-red-500/10 to-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-400/10 to-transparent" />
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-gray-500">Loss Limit</p>
          <p className="text-xs font-semibold text-red-500">${lossLimit}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500">Daily Target</p>
          <p className="text-xs font-semibold text-[#FFC038]">${dailyTarget}</p>
        </div>
      </div>

      {developerSettings.showTestTradeButton && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <TestTradeButton selectedAccount={selectedAccount} />
        </div>
      )}
    </div>
  );
}
