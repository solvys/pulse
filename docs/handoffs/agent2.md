# Agent 2 Handoff: Agentic AI Chat System

> **Branch**: Continue on `v.2.28.3` (or create `v.2.28.4` if needed)  
> **Scope**: Backend-only implementation  
> **Priority**: Follow existing patterns and modularity rules

---

## 🚨 CRITICAL: Follow These Rules

Before writing ANY code, read and follow these guidelines:

### 1. File Length (MANDATORY)
**Maximum 300 lines per file.** This is enforced across the entire codebase.

- See: `knowledge-base/CODE-MODULARITY-RULES.md`
- See: `.cursorrules` (line 13: "modular files (< 300 lines)")

If your implementation would exceed 300 lines, split it into:
- Handler files in `routes/ai/handlers/`
- Service modules in `services/ai/`
- Type definitions in `types/`

### 2. Existing Patterns
Follow the patterns established by Agent 1:
- Route structure: See `routes/riskflow.ts` (202 lines)
- Service structure: See `services/news-service.ts` (342 lines - NEEDS REFACTOR)
- Client structure: See `services/nitter-client.ts` (262 lines)

### 3. Implementation Plan
Follow: `docs/HANDOFF-NEW-BACKEND-IMPLEMENTATION.md` (Agent 1 section, lines 51-390)

---

## Your Task: Agentic AI Chat System

### What Already Exists
These files are in place but may need updates:

```
backend-hono/src/
├── routes/ai/
│   ├── index.ts              # Route registration (simplified)
│   ├── schemas.ts            # Zod schemas
│   └── handlers/
│       ├── chat.ts           # Chat handler (EXISTS)
│       ├── conversations.ts  # Conversation CRUD (EXISTS)
│       ├── threat.ts         # Threat history (EXISTS)
│       └── blind-spots.ts    # Blind spots (EXISTS)
├── services/ai/
│   ├── model-config.ts       # Model configuration (EXISTS)
│   ├── streaming.ts          # Streaming utilities (EXISTS)
│   └── firmware.ts           # AI firmware/system prompt (EXISTS)
└── services/ai-service.ts    # Main AI service (NEEDS WORK)
```

### What You Need To Do

1. **Review existing AI service** (`services/ai-service.ts`)
   - Check if it's functional or needs implementation
   - Ensure it follows 300-line rule

2. **Verify chat endpoints work**
   - `POST /api/ai/chat` - Streaming chat
   - `GET /api/ai/conversations` - List conversations
   - `POST /api/ai/conversations` - Create conversation
   - `DELETE /api/ai/conversations/:id` - Delete conversation

3. **Ensure Vercel AI SDK integration**
   - Model selection via `services/ai/model-config.ts`
   - Streaming via `services/ai/streaming.ts`
   - Context building from user data

4. **Test that no 500 errors occur**
   - Endpoints should return proper error responses, not crash

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                             │
│                   (Chat UI)                              │
└────────────────────────┬────────────────────────────────┘
                         │ POST /api/ai/chat
                         ▼
┌─────────────────────────────────────────────────────────┐
│              routes/ai/handlers/chat.ts                  │
│              (Request validation, auth)                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 services/ai-service.ts                   │
│              (Orchestration, context building)           │
└────────────────────────┬────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ model-config │ │  streaming   │ │   firmware   │
│   (models)   │ │  (SSE/stream)│ │  (prompts)   │
└──────────────┘ └──────────────┘ └──────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel AI Gateway                           │
│         (Grok, Claude, GPT via AI SDK)                   │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema (Already Exists)

```sql
-- ai_conversations
CREATE TABLE ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    model VARCHAR(100) DEFAULT 'grok-4',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_messages
CREATE TABLE ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Verification Checklist

Before marking complete:

- [ ] `npm run build` passes with no errors
- [ ] Server starts without 500 errors
- [ ] `POST /api/ai/chat` returns streaming response (or proper error)
- [ ] `GET /api/ai/conversations` returns list (empty is OK)
- [ ] All files under 300 lines
- [ ] Commit to branch with format: `[v.2.28.X] feat: implement agentic AI chat`

---

## Files to Modify/Create

| File | Action | Max Lines |
|------|--------|-----------|
| `services/ai-service.ts` | Implement/fix | 250 |
| `routes/ai/handlers/chat.ts` | Verify/fix | 200 |
| `routes/ai/handlers/conversations.ts` | Verify | 150 |
| `routes/ai/index.ts` | Already updated | 80 |

---

## Quick Commands

```bash
# Build and verify
cd backend-hono && npm run build

# Start dev server
npm run dev

# Test endpoints
curl http://localhost:8080/health
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/ai/conversations

# Check file lengths
wc -l src/services/ai-service.ts src/routes/ai/handlers/*.ts
```

---

## When Done

1. Verify build passes
2. Test endpoints don't return 500
3. Commit with version tag
4. Push to origin
5. Report: files changed, lines added/removed, any issues found
