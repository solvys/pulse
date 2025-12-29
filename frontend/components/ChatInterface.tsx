
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowRight, Paperclip, Image, FileText, Link2, AlertTriangle, TrendingUp, History, X, Pin, Archive, Edit2, MoreVertical } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/clerk-react";
import { useBackend } from "../lib/backend";
import { healingBowlPlayer } from "../utils/healingBowlSounds";
import { useSettings } from "../contexts/SettingsContext";
import ReactMarkdown from "react-markdown";
import { MessageRenderer } from "./chat/MessageRenderer";
import QuickPulseModal from "./analysis/QuickPulseModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface TiltWarning {
  detected: boolean;
  score?: number;
  message?: string;
}

const SUGGESTION_CHIPS = [
  { label: "Run the NTN report", prompt: "Run the NTN report" },
  { label: "Give me the Tale of the Tape (Weekly Summary)", prompt: "Give me the Tale of the Tape (Weekly Summary)" },
  { label: "Let's do a psych eval", prompt: "Let's do a psych eval" },
  { label: "How's my ER this week?", prompt: "How's my ER this week?" },
  { label: "Update my Blindspots", prompt: "Update my Blindspots" },
];

const THINKING_TERMS = [
  "finagling",
  "polagaling",
  "doodling",
  "tinkering",
  "pondering",
  "mulling",
  "ruminating",
  "contemplating",
  "considering",
  "weighing",
  "deliberating",
  "reflecting",
  "analyzing",
  "assessing",
  "evaluating",
  "bullish momentum",
  "uptrend confirmation",
  "breakout potential",
  "accumulation phase",
  "support holding",
  "resistance breaking",
  "volume expansion",
  "liquidity building",
  "risk-on sentiment",
  "fundamental strength",
  "earnings beat",
  "guidance raise",
  "positive catalyst",
  "momentum building",
];

interface ConversationSession {
  conversationId: string;
  updatedAt: Date;
  messageCount: number;
  preview: string;
  erStatus?: "Stable" | "Tilt" | "Neutral";
  pnl?: number;
  isArchived?: boolean;
  isPinned?: boolean;
  customName?: string;
  isStale?: boolean; // Stale after 24 hours
}

export default function ChatInterface() {
  const backend = useBackend();
  const { alertConfig } = useSettings();
  const { getToken } = useAuth();
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [thinkingText, setThinkingText] = useState("");
  const [tiltWarning, setTiltWarning] = useState<TiltWarning | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local input state for textarea
  const [input, setInput] = useState("");

  // Track loading state manually
  const [isStreaming, setIsStreaming] = useState(false);
  const [showQuickPulseModal, setShowQuickPulseModal] = useState(false);

  const useChatOptions = useMemo(() => ({
    api: `${API_BASE_URL}/api/ai/chat`,
    onFinish: (message: any) => {
      setIsStreaming(false);
      console.log('Message finished:', message);
    },
    onError: (error: any) => {
      setIsStreaming(false);
      console.error('Chat error:', error);
    },
  }), [conversationId]);

  const {
    messages: useChatMessages,
    append,
    status,
    setMessages: setUseChatMessages,
    input: chatInput,
    handleInputChange,
    handleSubmit
  } = useChat(useChatOptions) as any;

  const isLoading = isStreaming || status === 'streaming' || status === 'submitted';

  // Convert useChat messages to our Message format for display
  const messages: Message[] = (useChatMessages || [])
    .filter((msg: any) => msg.role !== 'system')
    .map((msg: any) => {
      // Handle potential parts array if present (multi-modal) or fallback to content string
      // The AI SDK Message type might have parts or content.
      let content = msg.content;
      if (msg.parts && Array.isArray(msg.parts)) {
        const textParts = msg.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
        if (textParts) content = textParts;
      }

      return {
        id: msg.id,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: content,
        timestamp: msg.createdAt || new Date(),
      };
    });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = input;
    }
  }, [input]);

  useEffect(() => {
    healingBowlPlayer.setSound(alertConfig.healingBowlSound);
  }, [alertConfig.healingBowlSound]);

  useEffect(() => {
    if (!isLoading) {
      setThinkingText("");
      return;
    }
    let currentIndex = 0;
    setThinkingText(THINKING_TERMS[0]);
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % THINKING_TERMS.length;
      setThinkingText(THINKING_TERMS[currentIndex]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const hasUserMessages = messages.some((m) => m.role === "user");
    if (hasUserMessages) {
      setShowSuggestions(false);
    }
  }, [messages]);

  const loadConversationHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await backend.ai.listConversations();
      const conversationsList = Array.isArray(response) ? response : [];
      const enrichedConversations = await Promise.all(
        conversationsList.map(async (conv: any) => {
          const now = new Date();
          const convDate = new Date(conv.updatedAt);
          const hoursSinceUpdate = (now.getTime() - convDate.getTime()) / (1000 * 60 * 60);
          const isStale = hoursSinceUpdate > 24;

          let erStatus: "Stable" | "Tilt" | "Neutral" | undefined;
          let pnl: number | undefined;

          try {
            const erSessions = await backend.er.getERSessions();
            const convDay = new Date(conv.updatedAt).toDateString();
            const sessions = Array.isArray(erSessions) ? erSessions : [];
            const sessionForDay = sessions.find(
              (s: any) => new Date(s.sessionStart).toDateString() === convDay
            );
            if (sessionForDay) {
              erStatus = sessionForDay.finalScore > 0.5 ? "Stable" : sessionForDay.finalScore < -0.5 ? "Tilt" : "Neutral";
            }
            const account = await backend.account.get();
            pnl = account.dailyPnl;
          } catch (error) { }

          return {
            ...conv,
            erStatus,
            pnl,
            isStale,
            isArchived: false,
            isPinned: false,
            customName: undefined,
          };
        })
      );
      setConversations(enrichedConversations);
    } catch (error) {
      console.error("Failed to load conversation history:", error);
      setConversations([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleArchiveConversation = (convId: string) => {
    setConversations(prev => prev.map(c =>
      c.conversationId === convId ? { ...c, isArchived: !c.isArchived } : c
    ));
  };

  const handlePinConversation = (convId: string) => {
    setConversations(prev => prev.map(c =>
      c.conversationId === convId ? { ...c, isPinned: !c.isPinned } : c
    ));
  };

  const handleRenameConversation = (convId: string, newName: string) => {
    setConversations(prev => prev.map(c =>
      c.conversationId === convId ? { ...c, customName: newName } : c
    ));
    setEditingConversationId(null);
    setRenameValue("");
  };

  const formatSessionTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const loadConversation = async (convId: string) => {
    const conv = conversations.find(c => c.conversationId === convId);
    if (conv?.isStale) {
      alert("This chat thread has gone stale after 24 hours. You can view it, but cannot send new messages. Start a new chat to continue the conversation.");
    }

    setShowHistory(false);
    try {
      const response = await backend.ai.getConversation(convId);
      const loadedMessages = (response.messages || []).map((msg: any, idx: number) => ({
        id: `${convId}-${idx}`,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        createdAt: new Date(),
      }));
      setUseChatMessages(loadedMessages);
      setConversationId(convId);
      setShowSuggestions(false);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  useEffect(() => {
    loadConversationHistory();
  }, []);

  const handleSend = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    if (conversationId) {
      const conv = conversations.find(c => c.conversationId === conversationId);
      if (conv?.isStale) {
        alert("This chat thread has gone stale after 24 hours. You cannot send new messages in this thread.");
        return;
      }
    }

    setShowSuggestions(false);
    setThinkingText(THINKING_TERMS[0]);
    setIsStreaming(true);

    try {
      const token = await getToken();
      await append({
        role: 'user',
        content: messageText
      }, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        },
        body: {
          conversationId
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      alert('Failed to send message. Please try again.');
    }

    if (!customMessage) {
      setInput("");
    }
  };

  const handleCheckTape = async () => {
    setShowSuggestions(false);
    try {
      const token = await getToken();
      await append({
        role: 'user',
        content: "Check the Tape"
      }, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        },
        body: { conversationId }
      });
    } catch (error) {
      console.error('Failed to send check tape command:', error);
    }
  };

  const handleDailyRecap = async () => {
    setShowSuggestions(false);
    try {
      const token = await getToken();
      await append({
        role: 'user',
        content: "Generate daily recap"
      }, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        },
        body: { conversationId }
      });
    } catch (error) {
      console.error('Failed to send daily recap command:', error);
    }
  };

  const handleQuickPulseComplete = async (result: any) => {
    // Format the analysis result as a markdown message
    const kpiSection = result.kpi ? `
### Key Levels
* **Entry 1:** ${result.kpi.entry1 || 'N/A'}
* **Entry 2:** ${result.kpi.entry2 || 'N/A'}
* **Stop:** ${result.kpi.stop || 'N/A'}
* **Target:** ${result.kpi.target || 'N/A'}
` : '';

    const messageContent = `
## ⚡ Quick Pulse Vision

**Bias:** ${result.bias} ${result.confidence ? `(${result.confidence}%)` : ''}

**Rationale:**
${result.rationale}
${kpiSection}
    `.trim();

    // Append as an assistant message
    // Note: In a real app, you might want to send a 'user' message first saying "Here is a chart..." 
    // but for now we just show the result.
    // Actually, let's append a hidden user message or just the result. 
    // Since append() sends to the API, we might not want to re-trigger the AI.
    // useChat's append sends a message. setMessages updates local state.

    // We want to just display it.
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: messageContent,
      timestamp: new Date()
    };

    setUseChatMessages((prev: any[]) => [...prev, newMessage]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with buttons */}
      <div className="bg-transparent">
        <div className="h-14 flex items-center justify-end px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSend("Run the NTN report")}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#FFC038]/40 hover:bg-[#FFC038]/10 disabled:opacity-50 rounded-lg text-[13px] text-zinc-300 hover:text-[#FFC038] transition-all whitespace-nowrap"
            >
              Run NTN Report
            </button>
            <button
              onClick={() => {
                setUseChatMessages([]);
                setConversationId(undefined);
                setShowSuggestions(true);
              }}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-xs font-medium text-zinc-400 whitespace-nowrap transition-colors"
            >
              New Chat
            </button>
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) {
                  loadConversationHistory();
                }
              }}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-xs font-medium text-zinc-400 whitespace-nowrap transition-colors flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>
      </div>

      {/* Tilt Warning Banner */}
      {tiltWarning?.detected && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-500">
              Emotional Tilt Detected (Score: {((tiltWarning.score ?? 0) * 100).toFixed(0)}%)
            </p>
            <p className="text-xs text-orange-400/80">{tiltWarning.message}</p>
          </div>
        </div>
      )}

      {/* Conversation History Sidebar */}
      {showHistory && (
        <div className="absolute inset-0 z-50 flex justify-end">
          <div className="w-80 bg-[#0a0a00] border-l border-[#FFC038]/20 flex flex-col">
            <div className="h-16 border-b border-[#FFC038]/20 flex items-center justify-between px-4">
              <h2 className="text-lg font-semibold text-[#FFC038]">Conversation History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-[#FFC038]/10 rounded transition-colors"
              >
                <X className="w-5 h-5 text-[#FFC038]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingHistory ? (
                <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-8">No previous conversations</div>
              ) : (
                conversations
                  .sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  })
                  .filter(c => !c.isArchived)
                  .map((conv) => {
                    const convDate = new Date(conv.updatedAt);
                    const isStale = conv.isStale || false;
                    const erStatus = conv.erStatus || "Neutral";
                    const pnl = conv.pnl || 0;
                    const erColor = erStatus === "Stable" ? "text-emerald-400" : erStatus === "Tilt" ? "text-red-500" : "text-zinc-400";
                    const pnlColor = pnl >= 0 ? "text-emerald-400" : "text-red-500";
                    const isEditing = editingConversationId === conv.conversationId;

                    return (
                      <div
                        key={conv.conversationId}
                        className={`group relative w-full p-3 bg-zinc-900/50 border ${isStale ? "border-zinc-700/50 opacity-60" : "border-zinc-800"
                          } hover:border-[#FFC038]/40 hover:bg-zinc-900 rounded-lg transition-all ${isStale ? "cursor-not-allowed" : ""}`}
                      >
                        {isStale && (
                          <div className="text-xs text-amber-500 mb-2 font-medium">
                            ⚠️ Chat threads go stale after 24 hours
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="text-xs text-zinc-400 mb-1">
                              {convDate.toLocaleDateString()} {formatSessionTime(convDate)}
                            </div>
                            <div className="flex items-center gap-3 text-xs mb-1">
                              <span className={erColor}>
                                ER: {erStatus}
                              </span>
                              <span className={pnlColor}>
                                P&L: {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                              </span>
                            </div>
                            {conv.customName ? (
                              <div className="text-sm text-zinc-300 font-medium mb-1">{conv.customName}</div>
                            ) : (
                              conv.preview && (
                                <div className="text-sm text-zinc-300 truncate">{conv.preview}...</div>
                              )
                            )}
                            <div className="text-xs text-zinc-500">{conv.messageCount} messages</div>
                          </div>
                          {conv.isPinned && (
                            <Pin className="w-4 h-4 text-[#FFC038] fill-[#FFC038]" />
                          )}
                        </div>
                        {!isStale && (
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePinConversation(conv.conversationId);
                              }}
                              className="p-1.5 hover:bg-[#FFC038]/10 rounded transition-colors"
                              title={conv.isPinned ? "Unpin" : "Pin"}
                            >
                              <Pin className={`w-3.5 h-3.5 ${conv.isPinned ? "text-[#FFC038] fill-[#FFC038]" : "text-zinc-400"}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingConversationId(conv.conversationId);
                                setRenameValue(conv.customName || "");
                              }}
                              className="p-1.5 hover:bg-[#FFC038]/10 rounded transition-colors"
                              title="Rename"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveConversation(conv.conversationId);
                              }}
                              className="p-1.5 hover:bg-[#FFC038]/10 rounded transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                          </div>
                        )}
                        {isEditing && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameConversation(conv.conversationId, renameValue);
                                }
                                if (e.key === "Escape") {
                                  setEditingConversationId(null);
                                  setRenameValue("");
                                }
                              }}
                              className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameConversation(conv.conversationId, renameValue)}
                              className="px-2 py-1 bg-[#FFC038]/20 text-[#FFC038] rounded text-xs"
                            >
                              Save
                            </button>
                          </div>
                        )}
                        {!isStale && (
                          <button
                            onClick={() => loadConversation(conv.conversationId)}
                            className="absolute inset-0 w-full h-full opacity-0"
                          />
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 pb-8">
        <div className="max-w-3xl mx-auto space-y-4 mb-8">
          {showSuggestions && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-[#FFC038] mb-3">The Name's Price. AI Price.</h3>
                <p className="text-base text-zinc-300 mb-2">
                  I'm Priced In's Risk Event Quant & Psych Specialist.
                </p>
                <p className="text-sm text-zinc-400">
                  Ask me anything about The Tape, The Markets, or yourself; I'm listening.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center w-full max-w-2xl">
                {SUGGESTION_CHIPS.map((chip, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(chip.prompt)}
                    disabled={isLoading}
                    className="px-4 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#FFC038]/40 hover:bg-[#FFC038]/10 disabled:opacity-50 rounded-full text-sm text-zinc-300 hover:text-[#FFC038] transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-xl p-4 backdrop-blur-md
                  ${message.role === "user"
                    ? "bg-[#FFC038]/10 border border-[#FFC038]/20"
                    : "bg-white/5 border border-white/10"
                  }
                `}
              >
                {message.role === "assistant" ? (
                  <div className="text-sm text-zinc-300 mb-2 max-w-none">
                    <MessageRenderer
                      content={message.content}
                      onRenderWidget={(widget: any) => null}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 mb-2 whitespace-pre-wrap">{message.content}</p>
                )}
                <span className="text-[9px] text-zinc-600 font-mono">{formatTime(message.timestamp)}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start items-center gap-3">
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 rounded-full border-2 border-[#FFC038]/40 animate-ping"></div>
                <div className="absolute inset-1 rounded-full border-2 border-[#FFC038]/60 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-[#FFC038]/20"></div>
              </div>
              <span className="text-sm text-[#FFC038] font-medium">{thinkingText}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 pt-6 pb-4 px-4 bg-[#050500]/80 backdrop-blur-md">
        <div className="w-full max-w-3xl mx-auto flex gap-2 items-end">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="relative flex items-center justify-center w-[42px] h-[42px] flex-shrink-0 hover:bg-white/10 rounded transition-colors z-10 self-end"
            type="button"
          >
            <Paperclip className="w-4 h-4 text-zinc-400 hover:text-[#FFC038] transition-colors" />

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-xl min-w-[200px] z-10">
                <button
                  onClick={() => setShowAttachMenu(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-[#FFC038]/10 rounded-lg transition-colors"
                >
                  <Image className="w-4 h-4" />
                  <span>Photo/Video</span>
                </button>
                <button
                  onClick={() => setShowAttachMenu(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-[#FFC038]/10 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Document</span>
                </button>
                <button
                  onClick={() => setShowAttachMenu(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-[#FFC038]/10 rounded-lg transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  <span>RiskFlow Item</span>
                </button>
              </div>
            )}
          </button>

          <textarea
            id="chat-message-input"
            name="chat-message"
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Analyze your performance, the news, or the markets…."
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-[18px] px-4 py-3 text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-[#FFC038]/40 focus:shadow-[0_0_12px_rgba(255,192,56,0.1)] disabled:opacity-50 transition-all resize-none overflow-y-auto min-h-[42px] max-h-[200px] leading-relaxed"
          />

          <button
            onClick={(e) => {
              e.preventDefault();
              handleSend();
            }}
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center w-[42px] h-[42px] flex-shrink-0 rounded-full bg-[#FFC038] hover:bg-[#FFD060] disabled:bg-zinc-900 disabled:text-zinc-700 disabled:border disabled:border-zinc-800 transition-all self-end"
            type="button"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <QuickPulseModal
        isOpen={showQuickPulseModal}
        onClose={() => setShowQuickPulseModal(false)}
        onAnalysisComplete={handleQuickPulseComplete}
      />
    </div>
  );
}
