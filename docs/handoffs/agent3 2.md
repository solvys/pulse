# Agent 3 Handoff: Autopilot Trading System

> **Branch**: Create `v.2.28.5` or continue on current  
> **Scope**: Backend-only implementation  
> **Research**: Explore Vercel AI Code Execution for Python-based trade analysis

---

## 🚨 CRITICAL: Follow These Rules

### 1. File Length (MANDATORY)
**Maximum 300 lines per file.** See `knowledge-base/CODE-MODULARITY-RULES.md`

### 2. Human-in-the-Loop (MANDATORY)
**NO TRADES EXECUTE WITHOUT USER APPROVAL.** This is non-negotiable.

### 3. ProjectX API Compliance
Follow `docs/integration/PROJECTX-API.md` EXACTLY - syntax must match perfectly.

---

## Your Task: Autopilot Trading System

### Part 1: Research Vercel AI Code Execution

Before implementing, research Vercel AI SDK's code execution feature for Python:

**Goal**: Use Python for trade execution analysis (backtesting, strategy logic, risk calculations)

**Research Tasks**:
1. Check Vercel AI SDK docs for code execution: https://sdk.vercel.ai/docs
2. Look for `@ai-sdk/python` or code interpreter features
3. Explore if Python can be used server-side for:
   - Strategy analysis
   - Risk calculations
   - Backtest simulations
   - Trade scoring

**Document findings in**: `docs/research/VERCEL-AI-CODE-EXECUTION.md`

### Part 2: Implement Autopilot (TypeScript First)

If Python execution isn't viable, implement in TypeScript following the architecture below.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                             │
│         (Proposal UI, Approval Buttons)                  │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ GET /status  │ │ GET /proposals││POST /acknowledge│
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│              routes/autopilot/index.ts                   │
│                  (Route registration)                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│             services/autopilot-engine.ts                 │
│      (Strategy detection, proposal generation)           │
└────────────────────────┬────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Risk Validator│ │ ProjectX API │ │  Strategies  │
│ (< 200 lines)│ │ (< 250 lines)│ │ (< 150 each) │
└──────────────┘ └──────────────┘ └──────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   ProjectX API                           │
│              (TopStepX Trading Platform)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Proposal Lifecycle (State Machine)

```
[Strategy Signal] 
       ↓
   ┌───────┐
   │ DRAFT │──── Risk validation fails ────→ [REJECTED]
   └───┬───┘
       │ Risk validated
       ↓
  ┌─────────┐
  │ PENDING │──── User rejects ────────────→ [REJECTED]
  └────┬────┘
       │ User approves          ┌─ Timeout ─→ [EXPIRED]
       ↓                        │
  ┌──────────┐                  │
  │ APPROVED │←─────────────────┘
  └────┬─────┘
       │ Execute trade
       ↓
  ┌───────────┐
  │ EXECUTING │──── API error ─────────────→ [FAILED]
  └─────┬─────┘
        │ Success
        ↓
   ┌──────────┐
   │ EXECUTED │
   └──────────┘
```

---

## API Endpoints to Implement

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/autopilot/status` | GET | Get autopilot status & settings |
| `/api/autopilot/settings` | POST | Update settings |
| `/api/autopilot/proposals` | GET | List pending proposals |
| `/api/autopilot/proposals/:id` | GET | Get proposal details |
| `/api/autopilot/acknowledge` | POST | Approve/reject proposal |
| `/api/autopilot/execute` | POST | Execute approved proposal |

---

## File Structure (Modular)

```
backend-hono/src/
├── routes/autopilot/
│   ├── index.ts              # Route registration (< 80 lines)
│   ├── schemas.ts            # Zod schemas (< 100 lines)
│   └── handlers/
│       ├── status.ts         # Status endpoint (< 100 lines)
│       ├── settings.ts       # Settings CRUD (< 150 lines)
│       ├── proposals.ts      # List/get proposals (< 150 lines)
│       ├── acknowledge.ts    # Approve/reject (< 150 lines)
│       └── execute.ts        # Trade execution (< 200 lines)
├── services/
│   ├── autopilot-engine.ts   # Main orchestration (< 250 lines)
│   ├── autopilot-risk.ts     # Risk validation (< 200 lines)
│   └── strategies/
│       ├── index.ts          # Strategy registry (< 50 lines)
│       ├── morning-flush.ts  # Strategy impl (< 150 lines each)
│       ├── power-hour.ts
│       ├── momentum.ts
│       └── mean-reversion.ts
```

---

## Database Schema

```sql
-- autopilot_settings (user preferences)
CREATE TABLE autopilot_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    daily_loss_limit DECIMAL(10,2) DEFAULT 500.00,
    max_position_size INTEGER DEFAULT 1,
    strategy_enabled JSONB DEFAULT '{}',
    require_stop_loss BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- autopilot_proposals (pending/executed trades)
CREATE TABLE autopilot_proposals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    entry_price DECIMAL(12,4),
    stop_loss DECIMAL(12,4),
    take_profit DECIMAL(12,4),
    reasoning TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    risk_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ
);

-- autopilot_executions (execution results)
CREATE TABLE autopilot_executions (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES autopilot_proposals(id),
    order_id VARCHAR(255),
    fill_price DECIMAL(12,4),
    fill_quantity INTEGER,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ProjectX API Integration

**CRITICAL**: Follow `docs/integration/PROJECTX-API.md` EXACTLY.

```typescript
// Example order placement (MUST match API exactly)
const order = {
  accountId: 12345,           // Integer, not string
  contractId: "CON.F.US.ES.M25", // Exact format
  type: 2,                    // 2 = Market order
  side: 0,                    // 0 = Buy, 1 = Sell
  size: 1,                    // Number of contracts
  stopLossBracket: {
    ticks: 20,
    type: 4                   // 4 = Stop order
  },
  takeProfitBracket: {
    ticks: 40,
    type: 1                   // 1 = Limit order
  }
};
```

---

## Vercel AI Code Execution Research

If researching Python execution, focus on:

### Use Cases for Python
1. **Strategy Backtesting**: Run historical simulations
2. **Risk Calculations**: Complex math (VaR, Sharpe, etc.)
3. **Trade Scoring**: ML-based trade quality scoring
4. **Pattern Detection**: Technical analysis patterns

### Questions to Answer
- Can Vercel AI run Python code server-side?
- What's the latency for code execution?
- Can we pass market data to Python for analysis?
- Can Python results be used in trade decisions?

### Potential Implementation
```typescript
// Hypothetical usage with Vercel AI code execution
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4-turbo'),
  tools: {
    execute_python: {
      description: 'Execute Python code for analysis',
      parameters: { code: z.string() },
      execute: async ({ code }) => {
        // Use Vercel AI's code interpreter
        return await runPythonCode(code);
      }
    }
  },
  prompt: 'Analyze this trade setup using Python...'
});
```

---

## Verification Checklist

- [ ] Research Vercel AI code execution documented
- [ ] All files under 300 lines
- [ ] No trades execute without user approval
- [ ] `npm run build` passes
- [ ] ProjectX API calls match documentation exactly
- [ ] Commit with version tag

---

## Quick Commands

```bash
# Build
cd backend-hono && npm run build

# Test (requires auth)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/autopilot/status

# Check file lengths
find src/routes/autopilot src/services -name "*.ts" -exec wc -l {} \;
```

---

## When Done

1. Document Python research findings
2. Implement TypeScript autopilot (or Python if viable)
3. Verify all endpoints work
4. Commit and push
5. Report: files created, lines of code, research findings
