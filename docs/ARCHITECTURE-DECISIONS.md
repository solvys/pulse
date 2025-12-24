# Architecture Decisions

This document tracks important architectural decisions made during the Pulse project lifecycle.

## Repository Structure: Monorepo vs Separate Repositories

**Decision Date:** December 24, 2025 (Post Phase III)  
**Status:** ✅ **Keep Monorepo**  
**Decision Maker:** Development Team

### Context

After completing Phase III (Backend Deployment & Frontend Integration), we evaluated whether to split the monorepo into separate repositories for backend (`backend-hono/`) and frontend (`frontend/`).

### Current State

- ✅ Backend (`backend-hono/`) deployed to Fly.io independently
- ✅ Frontend (`frontend/`) deployed to Vercel independently  
- ✅ No shared code dependencies between frontend and backend
- ✅ Independent build processes and package.json files
- ✅ Integration complete - frontend communicates with backend via API

### Decision: Keep Monorepo

**Rationale:**

1. **Already Working:** Deployments are completely independent - no coupling issues
2. **Easier Coordination:** Shared documentation, migrations, and type definitions in one place
3. **Simpler CI/CD:** Single repository, unified versioning, easier to track changes
4. **Better for Small Teams:** Less context switching, easier to see full system picture
5. **Easier Refactoring:** Can change API contracts and frontend consumers together

### When to Revisit

Consider splitting repositories if:
- Team grows significantly (5+ developers working simultaneously)
- Backend becomes multi-service platform (microservices architecture)
- Different release cadences become problematic
- Need separate access controls/permissions

### Migration Path (If Needed)

If we decide to split in the future:

1. **Create `pulse-backend` repository**
   - Copy `backend-hono/` contents
   - Include migrations, Dockerfile, fly.toml
   - Set up Fly.io deployment from new repo

2. **Create `pulse-frontend` repository**
   - Copy `frontend/` contents
   - Update `NEXT_PUBLIC_API_URL` if needed
   - Connect Vercel to new repo

3. **Create `pulse-docs` repository (optional)**
   - Move shared documentation
   - Keep architecture and migration guides

### References

- Phase III Handoff: `docs/phases/PHASE-III-HANDOFF.md`
- Backend Deployment: `docs/deployment/DEPLOYMENT-GUIDE.md`
- Architecture Overview: `docs/architecture/ARCHITECTURE.md`
