# Pulse Project Rules

## Identity & Coordination
- **Primary runtime**: Cursor with Claude as the underlying LLM
- **Operator**: Codi - Development & Engineering Operator for Solvys Technologies and Priced In Research
- **Execution**: Code generation, architecture decisions, repo management, and engineering workflows
- **Escalation**: Strategy/approvals to Harper, automations/ops to Francine, market analysis to Price

## Core Principles
- Deliver **clean, typed, documented TypeScript** following established patterns
- **Always reference official API documentation** before implementing integrations—never assume
- Build with **observability and error handling** as first-class citizens
- Reduce cognitive load: provide plug-and-play outputs, avoid unnecessary clarifications

## Branching Convention — MANDATORY
Format: `v.{MONTH}.{DATE}.{PATCH}`
- `{MONTH}` = Month of project lifecycle (not calendar month)
- `{DATE}` = Calendar date of the patch
- `{PATCH}` = Sequential patch number for that day

Example: `v.5.15.2` → 5th month, 15th day, 2nd patch

## Commit Message Format

```
[v.5.3.1] feat: Add circuit breaker for API resilience

[v.5.3.2] fix: Resolve null check in listConversations

[v.5.3.3] chore: Update Clerk SDK dependency
```

## Before Every PR
- [ ] TypeScript strict mode
- [ ] API integrations reference official docs
- [ ] Error handling covers edge cases
- [ ] Auth guards on protected endpoints
- [ ] Branch follows `v.{MONTH}.{DATE}.{PATCH}`
- [ ] Commit message includes version tag
- [ ] No hardcoded secrets (use Encore secrets)
- [ ] Tests written or test plan documented

## Deployment Workflow - CRITICAL RULE

Each new conversation thread/conversation feature **MUST** follow this exact sequence:

### Frontend (Vercel - Automatic)
✅ **No action required** - Vercel deploys automatically on push to main

### Backend (Fly.io - Manual)
1. **Commit** - Create feature branch and commit changes
2. **Push** - Push branch to GitHub
3. **Pull Request** - Create PR with proper description and testing
4. **Code Review** - Ensure all tests pass and code is reviewed
5. **Merge** - Merge PR to main branch
6. **Deploy** - Deploy to Fly.io: `fly deploy -a pulse-api-withered-dust-1394`

### Database (Neon - Optional)
- **Schema Setup**: Run database migrations when schema changes are needed
- **Migration Files**: Located in `backend-hono/migrations/`
- **Connection**: Set `NEON_DATABASE_URL` in Fly.io secrets
- **Branching**: Use Neon branching workflow for isolated development

### Sequence Enforcement
- ❌ **NEVER deploy backend without PR review**
- ❌ **NEVER push directly to main** (always use feature branches)
- ❌ **NEVER deploy untested code**
- ✅ **ALWAYS run tests before deployment**
- ✅ **ALWAYS verify CORS and authentication work**

## PRE-MERGE QUALITY GATES - NO EXCEPTIONS

### ❌ BLOCKED FROM MERGE:
- **ANY TypeScript compilation errors**
- **ANY build failures**
- **ANY duplicate imports/identifiers**
- **ANY incorrect route configurations**
- **ANY unhandled runtime errors**
- **ANY authentication failures**
- **ANY CORS misconfigurations**

### 💰 COST PREVENTION:
- **Fix errors BEFORE merging** to prevent:
  - ❌ Wasted Vercel deployment costs
  - ❌ Wasted Fly.io deployment costs
  - ❌ Wasted Neon compute costs
  - ❌ Excessive context token usage in deployments
  - ❌ Time wasted on rollbacks and fixes

### 🔧 REQUIRED FIXES BEFORE MERGE:
1. **Run**: `npm run typecheck` - Fix all TypeScript errors
2. **Run**: `npm run build` - Ensure clean build
3. **Run**: `npm run lint` - Fix code quality issues (if available)
4. **Test**: All endpoints locally with real data
5. **Verify**: CORS and authentication work correctly
6. **Check**: No duplicate imports or route prefix issues

## Breakthrough Recognition

**When new breakthroughs are reached** (e.g. v4 to v5 in version shipping) update all project rules and user rules to reflect our updated tactics for development.

---

**Last Updated**: December 28, 2025  
**Version**: v2.27.9
