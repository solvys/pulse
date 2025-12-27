import { TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useBackend } from '../../lib/backend';

interface ConversationThread {
  id: string;
  title: string;
  createdAt: Date;
  pnl?: number;
  resonanceState?: 'Stable' | 'Tilt' | 'Neutral';
}

export function ThreadHistory() {
  const backend = useBackend();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load conversations from backend
  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      try {
        const response = await backend.ai.listConversations();
        const conversations = Array.isArray(response) ? response : [];
        const enrichedThreads = await Promise.all(
          conversations.map(async (conv: any) => {
            // Try to get ER status and P&L for this session
            let erStatus: "Stable" | "Tilt" | "Neutral" | undefined;
            let pnl: number | undefined;
            
            try {
              const erSessions = await backend.er.getERSessions();
              const sessions = Array.isArray(erSessions) ? erSessions : [];
              const convDay = new Date(conv.updatedAt).toDateString();
              const sessionForDay = sessions.find(
                (s: any) => new Date(s.sessionStart).toDateString() === convDay
              );
              
              if (sessionForDay) {
                erStatus = sessionForDay.finalScore > 0.5 ? "Stable" : sessionForDay.finalScore < -0.5 ? "Tilt" : "Neutral";
              }

              const account = await backend.account.get();
              pnl = account.dailyPnl;
            } catch (error) {
              // Silently fail - these are optional enrichments
            }

            return {
              id: conv.conversationId,
              title: conv.preview || `Conversation ${conv.conversationId.slice(0, 8)}`,
              createdAt: new Date(conv.updatedAt),
              pnl,
              resonanceState: erStatus,
            };
          })
        );
        setThreads(enrichedThreads);
      } catch (error) {
        console.error("Failed to load conversation threads:", error);
        setThreads([]);
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
    // Refresh every 30 seconds
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
  }, [backend]);

  const groupThreadsByDate = () => {
    const now = new Date();
    const today: ConversationThread[] = [];
    const yesterday: ConversationThread[] = [];
    const previous7Days: ConversationThread[] = [];

    threads.forEach(thread => {
      const threadDate = new Date(thread.createdAt);
      const diffTime = now.getTime() - threadDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        today.push(thread);
      } else if (diffDays === 1) {
        yesterday.push(thread);
      } else if (diffDays <= 7) {
        previous7Days.push(thread);
      }
    });

    return { today, yesterday, previous7Days };
  };

  const { today, yesterday, previous7Days } = groupThreadsByDate();

  const deleteThread = async (threadId: string) => {
    // Note: Backend doesn't have delete endpoint yet, so we'll just remove from local state
    // In production, you'd call backend.ai.deleteConversation({ conversationId: threadId })
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
  };

  const ThreadGroup = ({ title, threads }: { title: string; threads: ConversationThread[] }) => {
    if (threads.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-xs text-gray-500 uppercase mb-2">{title}</h4>
        <div className="space-y-1">
          {threads.map(thread => (
            <div
              key={thread.id}
              className={`group relative p-2 rounded transition-colors ${
                activeThreadId === thread.id
                  ? 'bg-[#FFC038]/20 border border-[#FFC038]/30'
                  : 'hover:bg-[#FFC038]/10'
              }`}
            >
              <button
                onClick={() => setActiveThreadId(thread.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2 pr-6">
                  <span className="text-sm text-gray-200 truncate flex-1">{thread.title}</span>
                  {thread.pnl !== undefined && (
                    <div className="flex items-center gap-1">
                      {thread.pnl >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                      <span
                        className={`text-xs ${
                          thread.pnl >= 0 ? 'text-emerald-400' : 'text-red-500'
                        }`}
                      >
                        {thread.pnl >= 0 ? '+' : ''}
                        {thread.pnl.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                {thread.resonanceState && (
                  <div className="mt-1">
                    <span
                      className={`text-xs ${
                        thread.resonanceState === 'Stable'
                          ? 'text-emerald-400'
                          : thread.resonanceState === 'Tilt'
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {thread.resonanceState}
                    </span>
                  </div>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteThread(thread.id);
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#050500] border border-[#FFC038]/20 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-[#FFC038] mb-3">Session History</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-xs text-gray-500 text-center py-4">Loading...</div>
        ) : (
          <>
            <ThreadGroup title="Today" threads={today} />
            <ThreadGroup title="Yesterday" threads={yesterday} />
            <ThreadGroup title="Previous 7 Days" threads={previous7Days} />
            {threads.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-4">No sessions yet</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
