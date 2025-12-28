import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { RiskFlowItem } from "../types/api";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Button } from "./ui/Button";
import { IVScoreCard } from "./IVScoreCard";

export default function NewsFeed() {
  const backend = useBackend();
  const [riskflow, setRiskflow] = useState<RiskFlowItem[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  
  const availableSymbols = ['MNQ', 'ES', 'NQ', 'YM', 'RTY'];
  
  useEffect(() => {
    loadRiskFlow();
    const interval = setInterval(() => {
      loadRiskFlow();
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const loadRiskFlow = async () => {
    try {
      const data = await backend.riskflow.list({ limit: 20 });
      setRiskflow(data.items);
    } catch (error: any) {
      console.error('Failed to load RiskFlow:', error);
      if (error.code === "not_found" || error.code === "unauthenticated") {
        try {
          await backend.riskflow.seed();
          const newData = await backend.riskflow.list({ limit: 20 });
          setRiskflow(newData.items);
        } catch (seedError) {
          console.error('Failed to seed RiskFlow:', seedError);
        }
      }
    }
  };
  
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "high":
        return <AlertTriangle className="w-4 h-4 text-[#FF4040]" />;
      case "medium":
        return <TrendingUp className="w-4 h-4 text-[#FFC038]" />;
      default:
        return <Info className="w-4 h-4 text-zinc-500" />;
    }
  };
  
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-[#FF4040] bg-[#FF4040]/10";
      case "medium":
        return "text-[#FFC038] bg-[#FFC038]/10";
      default:
        return "text-zinc-500 bg-zinc-900/50";
    }
  };
  
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };
  
  const filteredRiskFlow = selectedSymbols.length > 0
    ? riskflow.filter(item => 
        selectedSymbols.some(symbol => 
          item.title.toLowerCase().includes(symbol.toLowerCase()) ||
          item.content?.toLowerCase().includes(symbol.toLowerCase())
        )
      )
    : riskflow;

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-zinc-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 mr-2">Filter by Symbol:</span>
            {availableSymbols.map(symbol => (
              <Button
                key={symbol}
                variant={selectedSymbols.includes(symbol) ? 'primary' : 'secondary'}
                onClick={() => toggleSymbol(symbol)}
                className="text-xs px-3 py-1"
              >
                /{symbol}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-3">
        {filteredRiskFlow.map((item) => (
          <div
            key={item.id}
            className="bg-[#0a0a00] border border-zinc-900 rounded-lg p-4 hover:border-zinc-800 transition-colors"
          >
            <div className="flex items-start gap-3">
              {getImpactIcon(item.impact || 'low')}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-medium text-white leading-tight">{item.title}</h3>
                  <div className="flex items-center gap-2">
                    <IVScoreCard score={item.ivScore || 0} />
                    <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${getImpactColor(item.impact || 'low')}`}>
                      {item.impact || 'low'}
                    </span>
                  </div>
                </div>
                
                {item.content && (
                  <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{item.content}</p>
                )}
                
                <div className="flex items-center gap-3 text-[9px] text-zinc-600">
                  <span className="text-[#FFC038]/60">{item.category || ''}</span>
                  <span>•</span>
                  <span>{formatDate(item.publishedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
