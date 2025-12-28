# Development Workflow Rules - Pulse Trading Platform

## Identity & Coordination
- **Primary runtime**: Cursor with Claude as the underlying LLM
- **Operator**: Codi - Development & Engineering Operator for Solvys Technologies and Priced In Research
- **Execution**: Code generation, architecture decisions, repo management, and engineering workflows
- **Escalation**: Strategy/approvals to Harper, automations/ops to Francine, market analysis to Price

## Core Principles
- Deliver **clean, typed, TypeScript** following established patterns
- **Always reference official API documentation** before implementing integrations—never assume
- Build with **observability and error handling** as first-class citizens
- Reduce cognitive load: provide plug-and-play outputs, avoid unnecessary clarifications

## 🔄 **Deployment Workflow - CRITICAL RULE**

Each new conversation thread/conversation feature **MUST** follow this exact sequence:

### **Frontend (Vercel - Automatic)**
✅ **No action required** - Vercel deploys automatically on push to main

### **Backend (Fly.io - Manual)**
1. **Commit** - Create feature branch and commit changes
2. **Push** - Push branch to GitHub
3. **Pull Request** - Create PR with proper description and testing
4. **Code Review** - Ensure all tests pass and code is reviewed
5. **Merge** - Merge PR to main branch
6. **Deploy** - Deploy to Fly.io: `fly deploy -a pulse-api-withered-dust-1394`

### **Database (Neon - Optional)**
- **Schema Setup**: Run database migrations when schema changes are needed
- **Migration Files**: Located in `backend-hono/migrations/`
- **Connection**: Set `NEON_DATABASE_URL` in Fly.io secrets
- **Branching**: Use Neon branching workflow for isolated development

### **Database (Neon - Optional)**
- **Only deploy database changes** when schema migrations are needed
- Use Neon branching workflow for isolated development
- Deploy production schema changes through migration scripts

### **Sequence Enforcement**
- ❌ **NEVER deploy backend without PR review**
- ❌ **NEVER push directly to main** (always use feature branches)
- ❌ **NEVER deploy untested code**
- ✅ **ALWAYS run tests before deployment**
- ✅ **ALWAYS verify CORS and authentication work**

## 🌿 **Branching Convention - UPDATED**

### **Format**: `v{user-defined-version}.{day-date}.{patch-number}`

**Examples:**
- `v1.0.1` - Version 1.0, Day 1, First patch
- `v2.15.3` - Version 2, Day 15, Third patch
- `v3.27.1` - Version 3, Day 27, First patch

**Rules:**
- `{user-defined-version}`: Major version number (1.0, 2.0, 3.0, etc.)
- `{day-date}`: Calendar day of the month (1-31)
- `{patch-number}`: Sequential patch number for that day (1, 2, 3, etc.)

**Previous format** (deprecated): `v.{MONTH}.{DATE}.{PATCH}`

## 📝 **Commit Message Format**

```
[v{version}.{day}.{patch}] {type}: {description}

Types: feat, fix, docs, style, refactor, test, chore
```

**Examples:**
```
[v2.15.1] feat: Add billing tier management endpoints
[v2.15.2] fix: Resolve CORS preflight request errors
[v2.15.3] chore: Update TypeScript dependencies
[v2.16.1] refactor: Simplify authentication middleware
```

## ✅ **Before Every PR**

### **Frontend Requirements:**
- [ ] TypeScript strict mode enabled
- [ ] All components properly typed
- [ ] Responsive design verified
- [ ] Accessibility standards met
- [ ] Performance optimized

### **Backend Requirements:**
- [ ] **Code Quality Checks Pass:**
  - [ ] TypeScript compilation (`npm run typecheck`)
  - [ ] Build succeeds (`npm run build`)
  - [ ] ESLint passes (`npm run lint`) - if available
  - [ ] No duplicate imports or identifiers
  - [ ] All route prefixes correct (`/api/` not `/api/api/`)
- [ ] **Error Resolution Required:**
  - [ ] Fix ALL TypeScript errors before merging
  - [ ] Fix ALL linting errors before merging
  - [ ] Resolve ALL build failures before merging
  - [ ] Test locally to ensure no runtime errors
- [ ] **Functionality Verification:**
  - [ ] All endpoints tested locally
  - [ ] CORS headers configured correctly
  - [ ] Authentication middleware working
  - [ ] Error handling implemented
  - [ ] Database migrations ready (if needed)

### **General Requirements:**
- [ ] Branch follows naming convention
- [ ] Commit message includes version tag
- [ ] No hardcoded secrets (use environment variables)
- [ ] Tests written or test plan documented
- [ ] Documentation updated (if needed)
- [ ] Breaking changes documented

## 🚫 **PRE-MERGE QUALITY GATES - NO EXCEPTIONS**

### **❌ BLOCKED FROM MERGE:**
- **ANY TypeScript compilation errors**
- **ANY build failures**
- **ANY duplicate imports/identifiers**
- **ANY incorrect route configurations**
- **ANY unhandled runtime errors**
- **ANY authentication failures**
- **ANY CORS misconfigurations**

### **💰 COST PREVENTION:**
- **Fix errors BEFORE merging** to prevent:
  - ❌ Wasted Vercel deployment costs
  - ❌ Wasted Fly.io deployment costs
  - ❌ Wasted Neon compute costs
  - ❌ Excessive context token usage in deployments
  - ❌ Time wasted on rollbacks and fixes

### **🔧 REQUIRED FIXES BEFORE MERGE:**
1. **Run**: `npm run typecheck` - Fix all TypeScript errors
2. **Run**: `npm run build` - Ensure clean build
3. **Run**: `npm run lint` - Fix code quality issues (if available)
4. **Test**: All endpoints locally with real data
5. **Verify**: CORS and authentication work correctly
6. **Check**: No duplicate imports or route prefix issues

## 🚀 **Deployment Checklist**

### **Pre-Deployment:**
- [ ] All PR requirements met
- [ ] Code reviewed and approved
- [ ] Tests passing on CI/CD
- [ ] Environment variables configured
- [ ] Database backups taken (if needed)

### **Fly.io Backend Deployment:**
```bash
# Verify build works
npm run build && npm run typecheck

# Deploy to Fly.io
fly deploy -a pulse-api-withered-dust-1394

# Verify deployment
curl https://pulse-api-withered-dust-1394.fly.dev/health
```

### **Post-Deployment:**
- [ ] Health checks pass
- [ ] Application responds correctly
- [ ] CORS headers present
- [ ] Authentication working
- [ ] Database connections working
- [ ] No console errors in frontend
- [ ] Performance metrics acceptable

## 🗄️ **Database Setup (Neon)**

### **Initial Setup:**
1. **Go to Neon Console**: https://console.neon.tech
2. **Create Project** or use existing one
3. **Go to SQL Editor**
4. **Run Migration**: Copy contents of `backend-hono/migrations/001_initial_schema.sql`
5. **Execute** the SQL to create all tables

### **Get Connection String:**
1. **Dashboard** → **Connection Details**
2. **Copy** the connection string (looks like: `postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require`)
3. **Set in Fly.io**: `fly secrets set NEON_DATABASE_URL="your_connection_string" -a pulse-api-withered-dust-1394`

### **Database Tables Created:**
- `broker_accounts` - Trading accounts
- `trades` - Individual trades
- `orders` - Trading orders
- `ai_conversations` - Chat sessions
- `ai_messages` - Chat messages
- `system_events` - System notifications
- `news_articles` - Market news
- `autopilot_settings` - AI trading settings
- `autopilot_proposals` - Suggested trades
- `emotional_resonance_scores` - Trading psychology
- And 15+ more tables for full functionality

## 🔧 **Environment Setup**

### **Frontend (Vercel):**
```bash
# Environment Variables
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_BASE_URL=https://pulse-api-withered-dust-1394.fly.dev
```

### **Backend (Fly.io):**
```bash
# Required Secrets
fly secrets set CLERK_SECRET_KEY="sk_live_..." -a pulse-api-withered-dust-1394
fly secrets set CORS_ORIGINS="https://pulse.solvys.io,http://localhost:3000" -a pulse-api-withered-dust-1394
fly secrets set NEON_DATABASE_URL="postgresql://..." -a pulse-api-withered-dust-1394

# Optional but Recommended
fly secrets set VERCEL_AI_GATEWAY_API_KEY="vercel_..." -a pulse-api-withered-dust-1394
```

## 📊 **Quality Gates**

### **Automated Checks:**
- ✅ **TypeScript compilation**
- ✅ **ESLint code quality**
- ✅ **Unit tests**
- ✅ **Integration tests**
- ✅ **Build process**

### **Manual Checks:**
- ✅ **Cross-browser compatibility**
- ✅ **Mobile responsiveness**
- ✅ **Performance benchmarks**
- ✅ **Security audit**
- ✅ **Accessibility audit**

## 🎯 **Breakthrough Recognition**

**When new breakthroughs are reached** (e.g., v2 to v3 in version shipping), update all project rules and user rules to reflect updated tactics for development.

---

**Last Updated**: December 28, 2025
**Version**: v2.27.9