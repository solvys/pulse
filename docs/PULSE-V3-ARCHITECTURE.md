# Pulse v3.0 Architecture
## Collaborative AI Trading Intelligence Platform

> **Version**: 3.0.0
> **Status**: Development
> **Last Updated**: 2026-01-02

---

## System Overview

Pulse v3.0 is a next-generation trading intelligence platform that combines collaborative AI agents, real-time market analysis, and automated trading proposals with human-in-the-loop validation.

### Core Components

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React + Vite Frontend]
        UI --> Combined[Combined Layout]
        UI --> Tickers[Tickers Only]
        UI --> Moveable[Moveable Panels]
    end

    subgraph "Backend Layer"
        API[Hono.js API<br/>Fly.io]
        API --> Auth[Clerk Auth]
        API --> RiskFlow[RiskFlow Engine]
        API --> Autopilot[Autopilot System]
        API --> AIOrch[AI Orchestrator]
    end

    subgraph "Collaborative AI Layer"
        AIOrch --> Analysts[Analyst Agents]
        AIOrch --> Researchers[Researcher Agents]
        AIOrch --> Trader[Trader Agent]
        AIOrch --> RiskMgr[Risk Manager]

        Analysts --> MA[Market Data<br/>Haiku]
        Analysts --> NS[News/Sentiment<br/>Grok]
        Analysts --> TA[Technical<br/>Haiku]

        Researchers --> Bull[Bullish<br/>Opus]
        Researchers --> Bear[Bearish<br/>Opus]

        Trader --> TradeDec[Trade Decision<br/>Opus]
        RiskMgr --> RiskDec[Risk Decision<br/>Opus]
    end

    subgraph "Data Sources"
        ProjectX[ProjectX API<br/>TopStepX]
        XAPI[X API<br/>@FinancialJuice<br/>@InsiderWire]
        FMP[FMP Economics<br/>Official Prints]
        Neon[(Neon DB)]
    end

    UI -.->|HTTPS| API
    API --> ProjectX
    API --> XAPI
    API --> FMP
    API --> Neon

    style UI fill:#e1f5fe
    style API fill:#fff3e0
    style AIOrch fill:#f3e5f5
    style ProjectX fill:#e8f5e9
    style XAPI fill:#e8f5e9
    style FMP fill:#e8f5e9
    style Neon fill:#fce4ec
```

---

## RiskFlow Architecture

RiskFlow is the real-time market intelligence feed that powers trading decisions.

### Data Flow

```mermaid
sequenceDiagram
    participant X as X API
    participant FMP as FMP Economics
    participant Backend as RiskFlow Engine
    participant Grok as Grok AI
    participant DB as Neon DB
    participant Frontend as UI Feed
    participant User as User

    loop Every 1 minute
        Backend->>X: Fetch @FinancialJuice
        Backend->>X: Fetch @InsiderWire
        X-->>Backend: News items

        Backend->>FMP: Check economic prints
        FMP-->>Backend: Economic data

        Backend->>Grok: Analyze news batch
        Note over Grok: IV Scoring<br/>Sentiment Analysis<br/>Hot Print Detection
        Grok-->>Backend: Analysis results

        Backend->>DB: Store analyzed articles
        Backend->>Frontend: Push updates
        Frontend->>User: Display feed
    end

    User->>Frontend: Select watch symbols
    Frontend->>Backend: Update preferences
    Backend->>DB: Store user config

    Note over Backend: Overnight Monitoring
    Backend->>Grok: Watch for major events
    Grok-->>Backend: Alert on market shakers
    Backend->>User: Push notification
```

### RiskFlow Data Schema

```mermaid
erDiagram
    NEWS_ARTICLES {
        uuid id PK
        string title
        text summary
        text content
        string source
        string url
        timestamp published_at
        string sentiment
        decimal iv_impact
        jsonb symbols
        boolean is_breaking
        int macro_level
        string price_brain_sentiment
        string price_brain_classification
        decimal implied_points
        string instrument
        string author_handle
        timestamp created_at
    }

    USER_WATCHLIST {
        uuid id PK
        string user_id FK
        jsonb symbols
        jsonb alert_preferences
        boolean overnight_monitoring
        timestamp updated_at
    }

    ECONOMIC_EVENTS {
        uuid id PK
        string event_name
        string currency
        string impact_level
        decimal actual
        decimal forecast
        decimal previous
        timestamp release_time
        boolean is_hot_print
    }

    USER_WATCHLIST ||--o{ NEWS_ARTICLES : monitors
    ECONOMIC_EVENTS ||--o{ NEWS_ARTICLES : triggers
```

---

## Collaborative AI Pipeline

The multi-agent system processes market data through specialized agents working in concert.

### Agent Execution Flow

```mermaid
stateDiagram-v2
    [*] --> MarketScan: Every 1 minute

    MarketScan --> AnalystPhase: Trigger Analysis

    state AnalystPhase {
        [*] --> MarketData: Haiku
        [*] --> NewsSentiment: Grok
        [*] --> Technical: Haiku

        MarketData --> ReportGen1
        NewsSentiment --> ReportGen2
        Technical --> ReportGen3

        ReportGen1 --> [*]
        ReportGen2 --> [*]
        ReportGen3 --> [*]
    }

    AnalystPhase --> SetupDetected: Check Signals
    SetupDetected --> ResearcherPhase: Setup Found
    SetupDetected --> [*]: No Setup

    state ResearcherPhase {
        [*] --> BullishAnalysis: Opus
        [*] --> BearishAnalysis: Opus

        BullishAnalysis --> Debate
        BearishAnalysis --> Debate

        state Debate {
            Round1 --> Round2
            Round2 --> Round3
            Round3 --> Consensus
        }

        Consensus --> [*]
    }

    ResearcherPhase --> TraderDecision: Consensus > 60%
    ResearcherPhase --> [*]: Low Consensus

    TraderDecision --> RiskAssessment: Opus
    RiskAssessment --> Approved: Pass
    RiskAssessment --> Rejected: Fail

    Approved --> UserApproval: Proposal
    UserApproval --> Execute: Approve
    UserApproval --> [*]: Reject

    Execute --> ProjectX: Place Order
    ProjectX --> [*]: Complete

    Rejected --> [*]
```

### Agent Communication Protocol

```mermaid
graph LR
    subgraph "Data Layer"
        MD[Market Data]
        NF[News Feed]
        TD[Technical Data]
    end

    subgraph "Analyst Layer"
        MDA[Market Analyst]
        NSA[News Analyst]
        TA[Tech Analyst]
    end

    subgraph "Research Layer"
        BR[Bullish Research]
        BER[Bearish Research]
        DB[Debate Protocol]
    end

    subgraph "Decision Layer"
        TR[Trader]
        RM[Risk Manager]
    end

    subgraph "Execution"
        PR[Proposal]
        US[User]
        EX[Execute]
    end

    MD --> MDA
    NF --> NSA
    TD --> TA

    MDA --> BR
    MDA --> BER
    NSA --> BR
    NSA --> BER
    TA --> BR
    TA --> BER

    BR --> DB
    BER --> DB

    DB --> TR
    TR --> RM
    RM --> PR
    PR --> US
    US --> EX

    style MDA fill:#e3f2fd
    style NSA fill:#e3f2fd
    style TA fill:#e3f2fd
    style BR fill:#fff3e0
    style BER fill:#fff3e0
    style TR fill:#f3e5f5
    style RM fill:#ffebee
```

---

## Trading Strategy Engine

Five core strategies implemented with specific entry/exit criteria.

### Strategy Activation Matrix

```mermaid
graph TB
    subgraph "Market Conditions"
        MC1[Opening Range Break]
        MC2[Hot Economic Print]
        MC3[Exhaustion Pattern]
        MC4[Overbought/Oversold]
        MC5[VIX > 22]
    end

    subgraph "Trading Strategies"
        S1[40/40 Club]
        S2[Print Charged Ripper]
        S3[Morning Flush]
        S4[Lunch/Power Flush]
        S5[22 VIX Fixer]
    end

    subgraph "Entry Triggers"
        ET1[ES/NQ Break + Antilag]
        ET2[Fib Bounce + Antilag]
        ET3[RSI Divergence + Sweep]
        ET4[Exhaustion + 20MA]
        ET5[Panic Drop + Bounce]
    end

    MC1 --> S1
    MC2 --> S2
    MC3 --> S3
    MC4 --> S4
    MC5 --> S5

    S1 --> ET1
    S2 --> ET2
    S3 --> ET3
    S4 --> ET4
    S5 --> ET5

    ET1 --> Execute[Execute Trade]
    ET2 --> Execute
    ET3 --> Execute
    ET4 --> Execute
    ET5 --> Execute

    style S1 fill:#e8f5e9
    style S2 fill:#fff9c4
    style S3 fill:#fce4ec
    style S4 fill:#f3e5f5
    style S5 fill:#e3f2fd
```

### Antilag Detection System

```mermaid
sequenceDiagram
    participant Primary as Primary (ES)
    participant Secondary as Secondary (NQ)
    participant Detector as Antilag Detector
    participant Strategy as Strategy Engine

    loop Every Tick
        Primary->>Detector: Price tick
        Secondary->>Detector: Price tick

        Detector->>Detector: Calculate 90s window

        alt Tick surge detected
            Detector->>Detector: Check price sync
            Note over Detector: Threshold: >X ticks/sec<br/>Correlation: >0.8

            alt Synchronized movement
                Detector->>Strategy: ANTILAG SIGNAL
                Strategy->>Strategy: Check other criteria
                Strategy-->>Primary: Entry signal
            end
        end
    end
```

---

## Autopilot System

Semi-autonomous trading with human approval workflow.

### Proposal Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Monitoring: User enables autopilot

    Monitoring --> SignalDetected: Strategy triggers
    SignalDetected --> ProposalCreated: Generate proposal

    ProposalCreated --> UserReview: Send to user

    UserReview --> Approved: User approves
    UserReview --> Rejected: User rejects
    UserReview --> Modified: User modifies
    UserReview --> Expired: 5 min timeout

    Modified --> UserReview: Review again

    Approved --> ExecutionPending: Queue for execution
    ExecutionPending --> Executing: Send to ProjectX

    Executing --> Filled: Order filled
    Executing --> PartialFill: Partial fill
    Executing --> Failed: Execution error

    Filled --> Monitoring: Complete
    PartialFill --> Monitoring: Complete
    Failed --> Monitoring: Log error

    Rejected --> Monitoring: Continue
    Expired --> Monitoring: Continue
```

### Overnight Monitoring

```mermaid
sequenceDiagram
    participant User as User
    participant System as System
    participant Grok as Grok AI
    participant Push as Push Service

    User->>System: Configure overnight watch
    Note over User: "Watch for war news"
    System->>System: Set alert criteria

    loop Every 5 minutes (overnight)
        System->>Grok: Analyze news feed
        Grok->>Grok: Check for major events

        alt Major event detected
            Grok-->>System: ALERT: Market shaker
            System->>System: Generate proposal
            System->>Push: Send notification
            Push-->>User: Push to mobile

            Note over User: User wakes up<br/>Reviews proposal

            User->>System: Approve/Reject
        end
    end
```

---

## Frontend Layout Architecture

Three layout modes with RiskFlow integration.

### Layout Mode Transitions

```mermaid
stateDiagram-v2
    Combined --> TickersOnly: Maximize TopStepX
    Combined --> Moveable: Rearrange panels

    TickersOnly --> Combined: Show panels
    TickersOnly --> Moveable: Custom layout

    Moveable --> Combined: Reset layout
    Moveable --> TickersOnly: Hide panels

    note right of Combined
        Default mode
        Left: MissionControl
        Center: TopStepX/Tape
        Right: RiskFlow
    end note

    note right of TickersOnly
        Trading focus
        Full TopStepX iframe
        Floating widgets only
    end note

    note right of Moveable
        Custom arrangement
        Swap left/right panels
        User preference
    end note
```

### Component Hierarchy

```mermaid
graph TD
    App[App Root]
    App --> Header[Header Bar]
    App --> Layout[Layout Controller]

    Header --> Logo[Logo Slot]
    Header --> UserTier[User Tier]
    Header --> VIX[VIX Ticker]
    Header --> IV[IV Score]
    Header --> LayoutToggle[Layout Mode]

    Layout --> NavRail[Navigation Rail]
    Layout --> MainArea[Main Area]

    NavRail --> NavIcons[Icon Navigation]
    NavRail --> PeekSidebar[Peek/Pin Sidebar]

    MainArea --> LeftPanel[Left Panel]
    MainArea --> CenterPanel[Center Panel]
    MainArea --> RightPanel[Right Panel]

    LeftPanel --> MissionControl[Mission Control]
    LeftPanel --> AutopilotWidget[Autopilot Status]

    CenterPanel --> TopStepX[TopStepX iframe]
    CenterPanel --> TapeFeed[Tape Feed]

    RightPanel --> RiskFlow[RiskFlow Feed]
    RightPanel --> NewsCards[News Cards]

    style App fill:#e1f5fe
    style Layout fill:#fff3e0
    style RiskFlow fill:#f3e5f5
```

---

## Performance Targets

### Latency Requirements

| Component | Target | Maximum |
|-----------|---------|---------|
| RiskFlow refresh | 60s | 90s |
| Analyst agents | 5s | 10s |
| Debate cycle | 30s | 45s |
| Full AI pipeline | 45s | 60s |
| Proposal generation | 2s | 5s |
| Order execution | 500ms | 2s |
| QuickPulse analysis | 3s | 5s |
| Chat response | 3s | 5s |

### Scalability Metrics

```mermaid
graph LR
    subgraph "Load Capacity"
        U1[100 Users]
        U2[1000 Users]
        U3[10000 Users]
    end

    subgraph "Infrastructure Scaling"
        I1[1 Fly Instance]
        I2[5 Fly Instances]
        I3[20 Fly Instances]
    end

    subgraph "AI Rate Limits"
        A1[100 req/min]
        A2[500 req/min]
        A3[2000 req/min]
    end

    U1 --> I1
    U2 --> I2
    U3 --> I3

    I1 --> A1
    I2 --> A2
    I3 --> A3

    Note1[Cache Layer: 60s TTL]
    Note2[DB Connection Pool: 20]
    Note3[AI Model Fallback: Haiku]
```

---

## Security Architecture

### Authentication & Authorization

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Clerk
    participant API
    participant DB

    User->>Frontend: Login
    Frontend->>Clerk: Authenticate
    Clerk-->>Frontend: JWT Token

    Frontend->>API: Request + JWT
    API->>Clerk: Verify Token
    Clerk-->>API: Valid/Invalid

    alt Valid Token
        API->>DB: Get user data
        DB-->>API: User info
        API-->>Frontend: Authorized response
    else Invalid Token
        API-->>Frontend: 401 Unauthorized
    end
```

### Data Security Layers

1. **Transport**: HTTPS/TLS 1.3
2. **Authentication**: Clerk JWT with 15-min expiry
3. **Database**: Encrypted at rest (Neon)
4. **Secrets**: Fly.io secret management
5. **API Keys**: Environment variables only
6. **Trading**: Human approval required

---

## Deployment Architecture

### Infrastructure Components

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Vercel"
            FE[Frontend<br/>React + Vite]
        end

        subgraph "Fly.io"
            API1[API Instance 1]
            API2[API Instance 2]
            API3[API Instance N]
            LB[Load Balancer]
        end

        subgraph "Neon"
            DB[(PostgreSQL)]
            REP[(Read Replica)]
        end

        subgraph "External Services"
            CL[Clerk Auth]
            PX[ProjectX API]
            XA[X API]
            FM[FMP API]
            AI[AI Services]
        end
    end

    Users[Users] --> CDN[Vercel CDN]
    CDN --> FE
    FE --> LB
    LB --> API1
    LB --> API2
    LB --> API3

    API1 --> DB
    API2 --> DB
    API3 --> REP

    API1 --> CL
    API1 --> PX
    API1 --> XA
    API1 --> FM
    API1 --> AI

    style FE fill:#e1f5fe
    style API1 fill:#fff3e0
    style DB fill:#fce4ec
```

---

## Monitoring & Observability

### Health Check Endpoints

- `/health` - Basic health check
- `/health/db` - Database connectivity
- `/health/ai` - AI services status
- `/health/projectx` - ProjectX API status
- `/metrics` - Prometheus metrics

### Key Metrics to Monitor

1. **API Performance**
   - Request latency (p50, p95, p99)
   - Error rates by endpoint
   - Active connections

2. **AI Pipeline**
   - Agent execution times
   - Token usage by model
   - Pipeline success rate

3. **Trading Metrics**
   - Proposals generated/approved/rejected
   - Order execution success rate
   - Strategy performance

4. **RiskFlow**
   - Feed update latency
   - News processing rate
   - IV scoring accuracy

---

## Technology Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Hono.js
- **Database**: Neon PostgreSQL
- **Cache**: Redis (future)
- **Queue**: BullMQ (future)

### Frontend
- **Framework**: React 18
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: React Context
- **Charts**: Recharts

### AI/ML
- **Claude Opus 4.5**: Complex reasoning
- **Claude Haiku 4.5**: Fast analysis
- **Grok**: News interpretation
- **Vercel AI SDK**: Orchestration

### Infrastructure
- **Frontend Host**: Vercel
- **Backend Host**: Fly.io
- **Database**: Neon
- **Auth**: Clerk
- **Trading**: ProjectX API

---

## Future Enhancements

### Phase 1 (Q1 2026)
- WebSocket for real-time updates
- Redis caching layer
- Advanced risk analytics

### Phase 2 (Q2 2026)
- Options trading support
- Multi-account management
- Custom strategy builder

### Phase 3 (Q3 2026)
- Mobile app (React Native)
- Voice commands
- AI strategy optimization

### Phase 4 (Q4 2026)
- Institutional features
- White-label solution
- Advanced backtesting

---

**End of Architecture Document**