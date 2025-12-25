import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { Account } from "../lib/api-types";

export default function AccountSummary() {
  const backend = useBackend();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    loadAccount();
    const interval = setInterval(loadAccount, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAccount = async () => {
    try {
      const data = await backend.getAccount();
      setAccount(data);
    } catch (error) {
      console.error('Failed to load account:', error);
    }
  };

  if (!account) {
    return (
      <div className="bg-[#140a00] rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-zinc-900 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-zinc-900 rounded"></div>
          <div className="h-3 bg-zinc-900 rounded"></div>
          <div className="h-3 bg-zinc-900 rounded"></div>
        </div>
      </div>
    );
  }

  const pnlPercentage = (account.dailyPnl / account.balance) * 100;
  const isPositive = account.dailyPnl >= 0;
  
  const barWidth = Math.min(Math.abs(pnlPercentage) * 2, 100);
  
  return (
    <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Account Summary</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Balance</span>
          <span className="text-sm font-mono text-white">${account.balance.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Equity</span>
          <span className="text-sm font-mono text-white">${account.equity.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Margin Used</span>
          <span className="text-sm font-mono text-zinc-400">${account.marginUsed.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="pt-3 border-t border-zinc-900">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[10px] text-zinc-500">Daily P&L</span>
          <div className="text-right">
            <div className={`text-sm font-mono font-bold ${isPositive ? "text-[#00FF85]" : "text-[#FF4040]"}`}>
              {isPositive ? "+" : ""}{account.dailyPnl.toFixed(2)}
            </div>
            <div className={`text-[9px] ${isPositive ? "text-[#00FF85]/70" : "text-[#FF4040]/70"}`}>
              {isPositive ? "+" : ""}{pnlPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${isPositive ? "bg-[#00FF85]" : "bg-[#FF4040]"}`}
            style={{
              width: `${barWidth}%`,
              marginLeft: isPositive ? "50%" : `${50 - barWidth}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
