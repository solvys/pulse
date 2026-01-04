# Pulse — Integrated Trading Environment

> **Pulse** is a comprehensive trading platform that integrates market data, risk management, journaling, and AI-powered insights into a unified interface.

## 🏗️ Project Structure

```
pulse/
├── frontend/          # Vite + React frontend (Vercel deployment)
├── docs/              # Project documentation
├── knowledge-base/    # Trading knowledge and strategies
└── scripts/           # Utility scripts
```

**Note**: Backend code has been removed and is being rebuilt from scratch. See `docs/DEBUGGING-BACKEND-ROADBLOCKS.md` for details.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (for local development)
- Fly.io CLI (for backend deployment)
- Vercel CLI (for frontend deployment)

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

See `docs/setup/SETUP-SUMMARY.md` for detailed setup instructions.

## 📚 Documentation

All documentation is organized in the `docs/` directory:

- **Migration Phases:** `docs/phases/` - Complete migration documentation
- **Deployment:** `docs/deployment/` - Deployment guides
- **Architecture:** `docs/architecture/` - System design and decisions
- **Integration:** `docs/integration/` - Third-party integrations
- **Setup:** `docs/setup/` - Configuration and setup guides

## 🔧 Key Technologies

- **Frontend:** Vite + React 19, TypeScript, Tailwind CSS
- **Auth:** Clerk
- **Database:** Neon PostgreSQL (backend being rebuilt)
- **Deployment:** Vercel (frontend), Backend TBD

## 📖 Architecture

See `docs/architecture/ARCHITECTURE.md` for complete system architecture.

## 🔐 Environment Variables

See `secrets.env` for environment variable reference (do not commit secrets).

Required variables:
- `NEON_DATABASE_URL` - Neon PostgreSQL connection string (backend uses this)
- `CLERK_SECRET_KEY` - Clerk authentication secret
- `VITE_API_URL` - Backend API URL
- `PROJECTX_USERNAME` / `PROJECTX_API_KEY` - TopStepX integration

## 🚢 Deployment

**Frontend (Vercel):**
```bash
cd frontend
vercel deploy
```

See `docs/deployment/DEPLOYMENT-GUIDE.md` for detailed instructions.

## 📝 Development Workflow

1. Create feature branch: `git checkout -b v.{MONTH}.{DATE}.{PATCH}`
2. Make changes following TypeScript strict mode
3. Test locally
4. Commit with format: `[v.X.Y.Z] type: description`
5. Create pull request

## 🗂️ Repository Organization

This is a **monorepo** containing both frontend and backend. See `docs/architecture/ARCHITECTURE-DECISIONS.md` for rationale.

## 📄 License

Proprietary - Solvys Technologies
