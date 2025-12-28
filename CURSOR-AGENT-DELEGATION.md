# Cursor Agent Delegation & Subagent Workflow Guide

## Overview

This guide explains how to set up autonomous agent-to-agent communication in Cursor, allowing multiple agents to delegate tasks and collaborate without manual copy-pasting of messages.

## Method 1: Single Chat Window with Agent Handoff

### Setup

1. **Create Agent Context Files**
   - Create `.cursor/agents/agent1-context.md` and `.cursor/agents/agent2-context.md`
   - Each file contains the agent's role, responsibilities, and handoff instructions

2. **Use Handoff Syntax in Chat**
   ```
   @agent2 Please review the API contract I've created and verify it matches your requirements.
   
   [HANDOFF]
   Agent: agent2
   Context: Review API endpoints in backend-hono/src/routes/ai.ts
   Task: Verify endpoint formats match autopilot requirements
   ```

3. **Agent Response Format**
   - Agent 2 responds with: `[ACKNOWLEDGED]` or `[DELEGATED]` to confirm handoff
   - Continue conversation in same window with agent switching context

### Example Workflow

```
You (to Agent 1): Implement the IV scoring endpoint with these requirements...
Agent 1: [Implements endpoint]
Agent 1: [HANDOFF] @agent2 - IV scoring endpoint ready. Please verify it matches your integration needs.
You (to Agent 2): Review the endpoint Agent 1 created...
Agent 2: [Reviews and provides feedback]
Agent 2: [HANDOFF] @agent1 - Endpoint looks good, but need `level` field added.
Agent 1: [Adds level field]
```

## Method 2: Multiple Chat Windows (Recommended for Complex Delegation)

### Setup

1. **Open Multiple Chat Windows**
   - Cmd/Ctrl + K to open chat
   - Open new chat window: Cmd/Ctrl + Shift + K (or duplicate chat)
   - Assign each window to a different agent

2. **Create Shared Context File**
   - Create `.cursor/shared-context.md` in project root
   - Both agents reference this file for shared state

3. **Use File-Based Communication**
   - Agent 1 writes to: `.cursor/agent1-status.md`
   - Agent 2 reads from: `.cursor/agent1-status.md`
   - Agent 2 writes to: `.cursor/agent2-status.md`
   - Agent 1 reads from: `.cursor/agent2-status.md`

### File Structure

```
.cursor/
├── agents/
│   ├── agent1-ai-integration.md
│   └── agent2-autopilot.md
├── shared-context.md
├── agent1-status.md
├── agent2-status.md
└── handoff-log.md
```

### Communication Protocol

**Agent 1 writes status:**
```markdown
# Agent 1 Status (AI Integration)

## Current Task
Implementing IV scoring endpoint

## Completed
- [x] Database migration created
- [x] Scoring service implemented

## Blockers
- Need clarification on symbol matching format

## Next Steps
- Implement GET /ai/score endpoint
- Add level field for autopilot integration

## Handoff Request
@agent2 - Please review scoring endpoint requirements in docs/HANDOFF-NEW-BACKEND-IMPLEMENTATION.md
```

**Agent 2 reads and responds:**
```markdown
# Agent 2 Status (Autopilot)

## Current Task
Reviewing Agent 1's IV scoring endpoint requirements

## Response to Agent 1
- Endpoint format looks good
- Need `level` field: 'low' | 'medium' | 'high' | 'good'
- Symbol matching: Use exact symbol string (e.g., "MNQ")

## Blockers
None - can proceed once Agent 1 implements endpoint

## Next Steps
- Wait for Agent 1 to complete endpoint
- Prepare integration code for IV score queries
```

## Method 3: Automated Task Flow (Advanced)

### Using Cursor Rules for Autonomous Delegation

1. **Create `.cursorrules` with delegation rules:**

```markdown
## Agent Delegation Rules

When Agent 1 (AI Integration) completes a task that affects Agent 2 (Autopilot):
1. Update `.cursor/agent1-status.md` with completion status
2. Add entry to `.cursor/handoff-log.md` with:
   - Task completed
   - Files changed
   - API endpoints created/modified
   - Next steps for Agent 2

When Agent 2 needs information from Agent 1:
1. Check `.cursor/agent1-status.md` for current status
2. Check `.cursor/handoff-log.md` for recent changes
3. If information missing, add request to `.cursor/agent2-requests.md`
4. Agent 1 monitors `.cursor/agent2-requests.md` and responds

## Handoff Protocol

Format for handoffs:
```
[HANDOFF]
From: Agent1
To: Agent2
Task: [Brief description]
Context: [Relevant files/endpoints]
Status: [Ready for review | Needs input | Blocked]
```

Format for responses:
```
[RESPONSE]
From: Agent2
To: Agent1
Status: [Approved | Needs changes | Blocked]
Feedback: [Specific feedback]
Next: [What Agent 1 should do next]
```
```

2. **Create Handoff Log Template:**

```markdown
# Handoff Log

## 2025-01-XX - IV Scoring Endpoint

**From:** Agent 1 (AI Integration)
**To:** Agent 2 (Autopilot)
**Task:** IV Scoring API endpoint implementation
**Files Changed:**
- `backend-hono/src/routes/ai.ts` - Added GET /ai/score endpoint
- `backend-hono/src/services/scoring-service.ts` - Added level field mapping

**API Contract:**
- Endpoint: `GET /ai/score?symbol={symbol}`
- Response: `{ score: number, level: 'low'|'medium'|'high'|'good', ... }`

**Status:** ✅ Ready for integration
**Next Steps for Agent 2:**
- Test endpoint with test symbol
- Integrate into autopilot proposal validation
- Verify level field mapping matches requirements
```

## Method 4: Using Cursor Composer for Multi-Agent Workflows

### Setup

1. **Open Composer** (Cmd/Ctrl + I)
2. **Reference Multiple Agents:**
   ```
   @agent1-context.md @agent2-context.md
   
   Agent 1: Implement IV scoring endpoint
   Agent 2: Review and provide integration requirements
   
   Both agents should coordinate via .cursor/handoff-log.md
   ```

3. **Composer will:**
   - Allow both agents to work in parallel
   - Reference shared context files
   - Coordinate through file-based communication

## Best Practices

### 1. Clear Handoff Points
- Define specific handoff triggers (e.g., "When endpoint is implemented")
- Use consistent handoff format
- Include all necessary context

### 2. Status Files
- Update status files frequently
- Include current task, blockers, and next steps
- Timestamp all updates

### 3. Shared Context
- Keep shared context file updated
- Include API contracts, data formats, integration points
- Both agents reference same source of truth

### 4. Error Handling
- Define fallback behavior if agent is unavailable
- Use circuit breaker pattern for agent communication
- Log all handoffs for debugging

### 5. Testing Coordination
- Coordinate integration testing
- Share test scenarios and expected outcomes
- Document test results in handoff log

## Example: Full Autonomous Workflow

### Step 1: Agent 1 Starts
```
Agent 1: [Updates .cursor/agent1-status.md]
Agent 1: [Implements IV scoring endpoint]
Agent 1: [Updates .cursor/handoff-log.md with completion]
```

### Step 2: Agent 2 Monitors
```
Agent 2: [Reads .cursor/handoff-log.md]
Agent 2: [Reviews endpoint implementation]
Agent 2: [Updates .cursor/agent2-status.md with feedback]
Agent 2: [Adds requirements to .cursor/agent2-requests.md if needed]
```

### Step 3: Agent 1 Responds
```
Agent 1: [Reads .cursor/agent2-status.md]
Agent 1: [Makes requested changes]
Agent 1: [Updates handoff log]
```

### Step 4: Continuous Loop
- Both agents monitor status files
- Automatic handoffs based on file changes
- No manual copy-pasting required

## Troubleshooting

### Agents Not Communicating
- Check that status files are being updated
- Verify file paths are correct
- Ensure both agents have read access to shared files

### Handoff Confusion
- Use consistent handoff format
- Include timestamps
- Reference specific files/endpoints

### Context Loss
- Keep shared context file comprehensive
- Include all relevant API contracts
- Document assumptions and decisions

## Tools & Extensions

### Recommended Cursor Settings
- Enable file watching for status files
- Use Cursor's file search to find handoff logs
- Set up file templates for status updates

### Automation Scripts (Optional)
```bash
# Watch for handoff updates
watch -n 5 'cat .cursor/handoff-log.md | tail -20'

# Notify on handoff
if [ -f .cursor/agent2-requests.md ]; then
  echo "Agent 2 has requests!"
fi
```

## Next Steps

1. Create the file structure above
2. Set up agent context files
3. Establish handoff protocol
4. Test with simple handoff
5. Scale to full autonomous workflow

---

**Note:** This workflow requires both agents to actively monitor status files. For true autonomy, consider using Cursor's Composer feature or external task orchestration tools.
