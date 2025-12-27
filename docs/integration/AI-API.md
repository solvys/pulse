# AI Integration API Documentation

This document describes the AI Integration API endpoints for PULSE, including endpoints used by the Autopilot system.

## Base URL

All endpoints are prefixed with `/ai` or `/news` and require authentication via Bearer token.

## Authentication

All endpoints require authentication. Include the Bearer token in the `Authorization` header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## IV Scoring Endpoints

### POST /ai/score

Calculate IV score on-demand.

**Request Body:**
```json
{
  "symbol": "ES",  // Optional
  "instrument": "ES"  // Optional
}
```

**Response:**
```json
{
  "score": 7.5,
  "level": "good",
  "timestamp": "2025-01-27T08:30:00Z",
  "vix": 18.5,
  "instrument": "ES",
  "color": "green"
}
```

### GET /ai/score?symbol={symbol}

Get IV score for specific symbol (Autopilot integration).

**Query Parameters:**
- `symbol` (required): Symbol string (e.g., "ES", "NQ", "MNQ")

**Response:**
```json
{
  "score": 7.5,
  "level": "good",
  "timestamp": "2025-01-27T08:30:00Z",
  "vix": 18.5,
  "instrument": "ES",
  "color": "green"
}
```

**Performance:** Target <500ms response time, cached for 30-60 seconds.

**Fallback:** If unavailable, returns default medium score.

### GET /ai/score/current

Get current general market IV score.

**Response:** Same as above.

### GET /ai/score/history

Get historical IV scores.

**Query Parameters:**
- `symbol` (optional): Filter by symbol
- `limit` (optional, default: 100): Number of results
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "scores": [
    {
      "id": 1,
      "score": 7.5,
      "level": "good",
      "timestamp": "2025-01-27T08:30:00Z",
      ...
    }
  ],
  "total": 150
}
```

### GET /ai/vix

Get live VIX ticker value.

**Response:**
```json
{
  "value": 18.5,
  "timestamp": "2025-01-27T08:30:00Z",
  "source": "external_api"
}
```

## Chat Endpoints

### GET /ai/conversations

List all user conversations.

**Response:**
```json
{
  "conversations": [
    {
      "conversationId": "123",
      "title": "Trading Strategy Discussion",
      "updatedAt": "2025-01-27T08:30:00Z",
      "createdAt": "2025-01-27T08:00:00Z"
    }
  ],
  "total": 10
}
```

### GET /ai/conversations/:id

Get conversation history with messages.

**Response:**
```json
{
  "conversationId": "123",
  "messages": [
    {
      "id": "1",
      "role": "user",
      "content": "Hello",
      "timestamp": "2025-01-27T08:00:00Z"
    },
    {
      "id": "2",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "timestamp": "2025-01-27T08:00:01Z"
    }
  ]
}
```

### GET /ai/get-conversation

Get conversation (frontend compatibility endpoint).

**Query Parameters:**
- `conversationId` (required)

**Response:** Same as GET /ai/conversations/:id

### POST /ai/conversations

Create new conversation.

**Request Body:**
```json
{
  "title": "New Conversation"  // Optional
}
```

**Response:**
```json
{
  "conversationId": "123",
  "title": "New Conversation",
  "createdAt": "2025-01-27T08:00:00Z",
  "updatedAt": "2025-01-27T08:00:00Z"
}
```

### DELETE /ai/conversations/:id

Delete conversation.

**Response:**
```json
{
  "success": true
}
```

### POST /ai/chat

Send message and get AI response.

**Request Body:**
```json
{
  "message": "What's the current market state?",
  "conversationId": "123",  // Optional
  "model": "grok-4"  // Optional: "grok-4" or "claude-opus-4"
}
```

**Response:**
```json
{
  "message": "The current market shows...",
  "conversationId": "123",
  "messageId": "456",
  "references": ["Over-trading", "Impatient entries"]  // Blind spots referenced
}
```

### POST /ai/check-tape

Check the tape (market analysis).

**Response:**
```json
{
  "message": "Current market analysis..."
}
```

### POST /ai/generate-daily-recap

Generate daily trading recap.

**Response:**
```json
{
  "message": "Today's trading recap..."
}
```

## Quick Pulse Analysis Endpoints

### POST /ai/quick-pulse

Generate quick pulse analysis.

**Request:** multipart/form-data
- `screenshot` (optional): Screenshot file (for web app upload)

**Response:**
```json
{
  "analysis": "Market analysis text...",
  "ivScore": 7.5,
  "vix": 18.5,
  "timestamp": "2025-01-27T08:30:00Z",
  "cached": false
}
```

### GET /ai/quick-pulse/cached

Get cached quick pulse analysis.

**Response:** Same as above, with `cached: true`

## Threat History Endpoints

### GET /ai/threat-history

Get threat history for user.

**Query Parameters:**
- `active` (optional): If "true", only returns threats from last 24 hours

**Response:**
```json
{
  "threats": [
    {
      "id": "1",
      "type": "overtrading",
      "severity": "high",
      "description": "Overtrading detected: 15 trades vs usual 10",
      "timestamp": "2025-01-27T08:30:00Z",
      "metadata": {
        "tradeCount": 15,
        "usualCount": 10,
        "dailyPnL": -250.50
      }
    }
  ]
}
```

### POST /ai/threat-history/analyze

AI-powered threat analysis.

**Request Body:**
```json
{
  "timeRange": "day",  // Optional: "day" | "week" | "month"
  "includeAnalysis": true  // Optional
}
```

**Response:**
```json
{
  "threats": [...],
  "analysis": {
    "summary": "Analysis summary...",
    "patterns": ["Pattern 1", "Pattern 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  }
}
```

## Blind Spots Endpoints

### GET /ai/blind-spots

Get user's blind spots (formatted for 3-column dropdown).

**Response:**
```json
{
  "blindSpots": [
    {
      "id": "1",
      "name": "Revenge trading",
      "isGuardRailed": true,
      "isActive": true,
      "category": "behavioral",
      "source": "ai",
      "createdAt": "2025-01-27T08:00:00Z"
    }
  ],
  "columns": {
    "column1": [...],  // Behavioral
    "column2": [...],  // Risk
    "column3": [...]   // Execution
  }
}
```

### POST /ai/blind-spots

Add or update blind spot.

**Request Body:**
```json
{
  "id": "1",  // Optional, for updates
  "name": "Custom blind spot",
  "category": "custom",  // Optional
  "isActive": true  // Optional
}
```

**Response:** Blind spot object

### DELETE /ai/blind-spots/:id

Remove blind spot (cannot delete guard-railed ones).

**Response:**
```json
{
  "success": true
}
```

## User Settings Endpoint

### GET /ai/user-settings

Get user settings (for Autopilot).

**Response:**
```json
{
  "usualTradesPerDuration": 10,
  "durationWindow": "24h",
  "selectedInstrument": "ES"
}
```

## News Event Endpoints (for Autopilot)

### GET /news/scheduled

Get scheduled news events.

**Query Parameters:**
- `startTime` (required): ISO 8601 timestamp
- `endTime` (required): ISO 8601 timestamp

**Response:**
```json
{
  "events": [
    {
      "id": "1",
      "title": "FOMC Meeting",
      "scheduledTime": "2025-01-27T14:00:00Z",
      "source": "TradingView",
      "impact": "high",
      "symbols": ["ES", "NQ"],
      "isCommentary": false
    }
  ]
}
```

**Fallback:** If unavailable, returns empty array.

### GET /news/breaking

Get breaking news for symbol.

**Query Parameters:**
- `symbol` (optional): Filter by symbol

**Response:**
```json
{
  "hasBreakingNews": true,
  "events": [
    {
      "id": "1",
      "title": "Breaking: Market News",
      "publishedAt": "2025-01-27T08:25:00Z",
      "impact": "high",
      "symbols": ["ES"]
    }
  ],
  "pausedUntil": "2025-01-27T08:35:00Z"  // When to resume
}
```

**Fallback:** If unavailable, returns `hasBreakingNews: false`.

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "details": {}  // Optional, for validation errors
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `404`: Not Found
- `500`: Internal Server Error

## Error Handling Strategy

**Graceful Degradation:**
- IV Scoring unavailable: Returns default "medium" score
- Scheduled news unavailable: Returns empty array (assumes no events)
- Breaking news unavailable: Returns `hasBreakingNews: false`
- Threat history unavailable: Blocks proposals (fail-safe)
- Blind spots unavailable: Blocks proposals (fail-safe)

**Critical Endpoints (fail-safe):**
- Threat history and blind spots: If unavailable, autopilot should block all proposals

**Non-Critical Endpoints:**
- IV scoring, news events: Use defaults/fallbacks, log warnings

## Performance Requirements

- IV Score queries: Target <500ms response time
- Combined validation: <1s for all pre-proposal checks
- Caching: Server-side cache IV scores for 30-60 seconds
- Parallel calls: All endpoints can be called in parallel

## Stub Endpoints (for Development)

During development, these endpoints return mock data:

- `GET /ai/score?symbol={symbol}`: Returns `{ score: 5, level: 'medium', ... }`
- `GET /news/scheduled`: Returns `{ events: [] }`
- `GET /news/breaking`: Returns `{ hasBreakingNews: false, events: [] }`

Replace with real implementations once available.
