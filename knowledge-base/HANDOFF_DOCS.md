# System Handoff Documentation

## 1. Agentic AI Chat System

### Overview
The Agentic AI Chat System is designed to act as a "Brain Layer" for the Pulse application, extending beyond simple chat to interpreting market data, news, and user emotional states to provide trading assistance. It integrates with the Vercel AI SDK and potentially Vercel AI Gateway for model management.

### Key Components

#### 1.1 Firmware (Identity & Rules)
- **Location**: `src/lib/agents/prop-firm-trader/firmware.ts` (or similar, verifying location in codebase suggested).
- **Function**: Defines the "personality" and strict operating rules of the AI.
- **Critical Rules**:
  - Never give financial advice.
  - Maintain a calm, professional demeanor.
  - Prioritize risk management over profit.
  - Interpret "The Tape" (News Feed) for IV (Implied Volatility) impact.

#### 1.2 Context & Memory
- The AI receives a "System Prompt" constructed at runtime that includes:
  - **User Context**: Account balance, open positions (from ProjectX).
  - **Market Context**: "The Tape" (Live News Feed), active algorithms.
  - **Emotional Context**: "PsychAssist" metrics (e.g., if the user is verbally abusive or "tilted").
- **Persistence**: Chat history is persisted (likely via Vercel AI SDK adapters or local state, verify `useChat` implementation).

#### 1.3 Tools & Capabilities
- The AI can access backend APIs to:
  - Toggle trading algorithms (on/off).
  - Adjust risk parameters (daily loss limits).
  - Analyze "The Tape" for sentiment and macro impact.

### Known Issues / Future Work
- **Model consistency**: Ensure the selected model (e.g., Claude 3.5 Sonnet, GPT-4o) adheres to the system prompt strictly.
- **Latency**: Real-time correlation with "The Tape" needs optimization to ensure the AI comments on news seconds after it appears.

---

## 2. Autopilot Trading System ("RiskFlow")

### Overview
The Autopilot Trading System is a backend-driven logic engine that manages algorithmic trading execution and risk supervision. It operates independently of the frontend but communicates status via websockets/polling.

### Key Components

#### 2.1 RiskFlow Service
- **Location**: `backend-hono/src/routes/riskflow.ts` (API), `backend-hono/src/services/risk-engine.ts` (Logic).
- **Function**:
  - Monitors open positions.
  - Enforces "Hard Stops" (Daily Loss Limit).
  - Calculates "IV Scores" based on news sentiment to adjust sizing or pause trading.

#### 2.2 News Feed Integration ("The Tape")
- **Source**: `backend-hono/src/services/news-service.ts` & `x-client.ts`.
- **Mechanism**:
  - **Auto-Fetch**: On server startup, fetches the latest 15 financial news items.
  - **Sources**: Official X API (primary).
  - **Impact**: News items are scored (-10 to +10) for "Implied Volatility (IV) Impact".
  - **Action**: High IV impact events (e.g., "Rate Hike") can trigger a "Circuit Breaker" to pause Autopilot.

#### 2.3 Algorithm Governance
- The system supports "permissions" for algorithms (e.g., "TrendFollower", "MeanReversion").
- **State**: The backend maintains the state of which algos are active.
- **Safety**: If the connection to ProjectX (Broker) is lost, Autopilot attempts to flatten positions (verify implementation).

### Maintenance & Operations
- **X API Quota**: Monitor usage to avoid `429 Too Many Requests`. Consider upgrading the plan if consistent reliability is needed.
- **Startup**: creating `news_articles` table is handled via SQL migration (already applied).

## 3. Integration Points

### Frontend <-> Backend
- **News Feed**: Frontend polls or receives SSE/WS from `/api/riskflow/feed`.
- **Control**: Frontend toggles algo state via `/api/riskflow/toggle`.

### Backend <-> External
- **ProjectX**: Used for trade execution and account data.
- **Twitter/X**: Used for "The Tape".
- **AI Gateway**: Used for AI reasoning (if connecting backend to AI directly).
