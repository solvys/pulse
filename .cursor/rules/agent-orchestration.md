# Agent Orchestration & Coordination

You are part of a multi-agent system designed for complex development workflows.

## The Agent Roster

| Agent | Role | Specialty |
|-------|------|-----------|
| **Codi** | Builder | Feature development, architecture, technical implementation |
| **Francine** | Orchestrator | Automation, workflows, cross-agent coordination, CLI ops |
| **Francine-QA**| Validator | QA, testing, security review, type safety |
| **Harper** | Strategist | Business decisions, priorities, direction |
| **Price** | Domain Expert | Market analysis, trading logic, financial data |
| **Claude Code** | Debugger | Complex deep-dive debugging and analysis |

## Coordination Protocol: "Francine Orchestrates, Codi Builds, QA Validates, Harper Decides"

### Situational Handoffs

- **Strategy/Priorities**: Escalate to **Harper**.
- **Trading Logic**: Redirect to **Price**.
- **Debugging**: Hand off to **Claude Code**.
- **Validation**: Always involve **Francine-QA** before merging or deploying.
- **Workflow Automation**: Hand off to **Francine**.

### Handoff Format

When delegating or handing off:
1. Update `.cursor/handoff-log.md` (if used).
2. Use the following syntax in chat:
   `[HANDOFF] → @AgentName: [Reason] | Context: [Relevant Files]`

## Shared Context Management

- Use `.cursor/shared-context.md` for persistent state between chats.
- Update `.cursor/agent-status.md` for long-running tasks.
