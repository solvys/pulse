# Phase 4 — Debugging Sweep & UX QA → Electron DMG

> **Objective**: Comprehensive QA sweep (integration + E2E tests), UX polish, and Electron desktop app packaging (DMG).

> **Deliverable**: All tests pass, UX is polished, Electron DMG builds successfully.

---

## 4.1 Integration Testing (Vitest)

### A) Backend API Tests

**File: `tests/api/journal.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL || 'https://pulse-api.fly.dev';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN!;

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

describe('Journal API', () => {
  it('should return journal stats', async () => {
    const res = await fetch(`${API_URL}/journal/stats`, { headers });
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('winRate');
    expect(data).toHaveProperty('avgPnL');
    expect(data).toHaveProperty('totalTrades');
    expect(data).toHaveProperty('currentStreak');
    expect(data.currentStreak).toHaveProperty('type');
    expect(data.currentStreak).toHaveProperty('count');
  });
  
  it('should return calendar data for a month', async () => {
    const res = await fetch(`${API_URL}/journal/calendar?month=2025-12`, { headers });
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('days');
    expect(Array.isArray(data.days)).toBe(true);
    
    if (data.days.length > 0) {
      const day = data.days[0];
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('pnl');
      expect(day).toHaveProperty('status');
      expect(['profitable', 'loss', 'breakeven', 'no-trades']).toContain(day.status);
    }
  });
  
  it('should return date detail with P&L by time', async () => {
    const res = await fetch(`${API_URL}/journal/date/2025-12-15`, { headers });
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('date');
    expect(data).toHaveProperty('netPnL');
    expect(data).toHaveProperty('pnlByTime');
    expect(data).toHaveProperty('orders');
    
    expect(Array.isArray(data.pnlByTime)).toBe(true);
    if (data.pnlByTime.length > 0) {
      expect(data.pnlByTime[0]).toHaveProperty('hour');
      expect(data.pnlByTime[0]).toHaveProperty('pnl');
    }
  });
});
```

**File: `tests/api/er.test.ts`**

```typescript
describe('ER/Blindspot API', () => {
  it('should return ER scores by hour for a date', async () => {
    const res = await fetch(`${API_URL}/er/date/2025-12-15`, { headers });
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('erByTime');
    expect(Array.isArray(data.erByTime)).toBe(true);
    
    if (data.erByTime.length > 0) {
      expect(data.erByTime[0]).toHaveProperty('hour');
      expect(data.erByTime[0]).toHaveProperty('score');
      expect(data.erByTime[0].score).toBeGreaterThanOrEqual(0);
      expect(data.erByTime[0].score).toBeLessThanOrEqual(10);
    }
  });
  
  it('should return blindspot rating (0-10)', async () => {
    const res = await fetch(`${API_URL}/er/blindspots/2025-12-15`, { headers });
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('score');
    expect(data).toHaveProperty('summary');
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(10);
    expect(typeof data.summary).toBe('string');
  });
});
```

**File: `tests/api/econ.test.ts`**

```typescript
describe('Econ Calendar API', () => {
  it('should trigger interpretation job', async () => {
    const res = await fetch(`${API_URL}/econ/interpret`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        date: '2025-12-15',
        timezone: 'America/New_York',
        region: 'US',
      }),
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('status');
    expect(['queued', 'processing', 'completed', 'failed']).toContain(data.status);
  });
  
  it('should return cached plan for a date', async () => {
    const res = await fetch(`${API_URL}/econ/day/2025-12-15`, { headers });
    
    // May be 404 if not cached yet
    if (res.status === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('date');
      expect(data).toHaveProperty('plan');
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('source');
    }
  });
});
```

---

## 4.2 End-to-End Testing (Playwright)

### A) Navigation Tests

**File: `e2e/navigation.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Navigation System', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');
  });
  
  test('nav rail displays all icons', async ({ page }) => {
    await expect(page.locator('[data-testid="nav-tape"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-riskflow"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-journal"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-econ"]')).toBeVisible();
  });
  
  test('hover on nav edge peeks sidebar', async ({ page }) => {
    const sidebar = page.locator('[data-testid="nav-sidebar"]');
    
    // Initially hidden
    await expect(sidebar).not.toBeVisible();
    
    // Hover on left edge
    await page.hover('body', { position: { x: 10, y: 400 } });
    
    // Sidebar should peek
    await expect(sidebar).toBeVisible();
    
    // Move mouse away
    await page.mouse.move(500, 400);
    
    // Sidebar should hide again
    await expect(sidebar).not.toBeVisible();
  });
  
  test('click pin keeps sidebar open', async ({ page }) => {
    // Hover to peek
    await page.hover('body', { position: { x: 10, y: 400 } });
    
    // Click pin
    await page.click('[data-testid="nav-sidebar-pin"]');
    
    // Move mouse away
    await page.mouse.move(500, 400);
    
    // Sidebar should stay open
    const sidebar = page.locator('[data-testid="nav-sidebar"]');
    await expect(sidebar).toBeVisible();
    
    // Click close
    await page.click('[data-testid="nav-sidebar-close"]');
    await expect(sidebar).not.toBeVisible();
  });
  
  test('clicking nav icons switches sections', async ({ page }) => {
    // Click RiskFlow
    await page.click('[data-testid="nav-riskflow"]');
    await expect(page.locator('[data-testid="riskflow-section"]')).toBeVisible();
    
    // Click Journal
    await page.click('[data-testid="nav-journal"]');
    await expect(page.locator('[data-testid="journal-section"]')).toBeVisible();
    
    // Click Econ Calendar
    await page.click('[data-testid="nav-econ"]');
    await expect(page.locator('[data-testid="econ-section"]')).toBeVisible();
  });
});
```

### B) RiskFlow Tests

**File: `e2e/riskflow.spec.ts`**

```typescript
test.describe('RiskFlow Section', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');
    await page.click('[data-testid="nav-riskflow"]');
  });
  
  test('KPI row displays 4 cards in correct order', async ({ page }) => {
    const kpiRow = page.locator('[data-testid="kpi-row"]');
    await expect(kpiRow).toBeVisible();
    
    // Card 1: Selected Instrument (ticker, no gradient)
    const card1 = page.locator('[data-testid="kpi-card-1"]');
    await expect(card1).toBeVisible();
    await expect(card1.locator('[data-testid="ticker-symbol"]')).toBeVisible();
    
    // Card 2: Area-line KPI (gradient allowed)
    const card2 = page.locator('[data-testid="kpi-card-2"]');
    await expect(card2).toBeVisible();
    await expect(card2.locator('[data-testid="area-chart"]')).toBeVisible();
    
    // Card 3: Area-line KPI (gradient allowed)
    const card3 = page.locator('[data-testid="kpi-card-3"]');
    await expect(card3).toBeVisible();
    await expect(card3.locator('[data-testid="area-chart"]')).toBeVisible();
    
    // Card 4: NewsPlanForDay (ticker, no gradient)
    const card4 = page.locator('[data-testid="kpi-card-4"]');
    await expect(card4).toBeVisible();
    await expect(card4.locator('[data-testid="news-plan-ticker"]')).toBeVisible();
  });
  
  test('KPI graphs use area-line charts with gradient fill', async ({ page }) => {
    const card2 = page.locator('[data-testid="kpi-card-2"]');
    const chart = card2.locator('[data-testid="area-chart"]');
    
    // Check that gradient is applied to fill (not to card background)
    const chartFill = chart.locator('path[fill*="gradient"]');
    await expect(chartFill.first()).toBeVisible();
    
    // Card itself should not have gradient
    const cardBg = await card2.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.backgroundImage;
    });
    expect(cardBg).not.toContain('gradient');
  });
});
```

### C) Journal Tests

**File: `e2e/journal.spec.ts`**

```typescript
test.describe('Journal Section', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');
    await page.click('[data-testid="nav-journal"]');
  });
  
  test('calendar day tiles are colored by P&L', async ({ page }) => {
    const calendar = page.locator('[data-testid="journal-calendar"]');
    await expect(calendar).toBeVisible();
    
    // Find a day with trades
    const dayWithTrades = page.locator('[data-testid="calendar-day"][data-has-trades="true"]').first();
    
    if (await dayWithTrades.count() > 0) {
      // Get background color
      const bgColor = await dayWithTrades.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      
      // Should have a color (not transparent)
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
      
      // Check data attribute for status
      const status = await dayWithTrades.getAttribute('data-status');
      expect(['profitable', 'loss', 'breakeven']).toContain(status);
    }
  });
  
  test('clicking calendar date opens modal with area-line charts', async ({ page }) => {
    const dayWithTrades = page.locator('[data-testid="calendar-day"][data-has-trades="true"]').first();
    
    if (await dayWithTrades.count() > 0) {
      await dayWithTrades.click();
      
      const modal = page.locator('[data-testid="day-detail-modal"]');
      await expect(modal).toBeVisible();
      
      // P&L by time should be area-line chart
      const pnlChart = modal.locator('[data-testid="pnl-by-time-chart"]');
      await expect(pnlChart).toBeVisible();
      
      // Check for gradient fill in chart
      const pnlGradient = pnlChart.locator('path[fill*="gradient"]');
      await expect(pnlGradient.first()).toBeVisible();
      
      // ER by time should be area-line chart
      const erChart = modal.locator('[data-testid="er-by-time-chart"]');
      await expect(erChart).toBeVisible();
      
      const erGradient = erChart.locator('path[fill*="gradient"]');
      await expect(erGradient.first()).toBeVisible();
      
      // Order history table should be visible
      await expect(modal.locator('[data-testid="order-history-table"]')).toBeVisible();
      
      // Chat with Price button should be visible
      await expect(modal.locator('[data-testid="chat-with-price-button"]')).toBeVisible();
      
      // No incident summary (removed)
      await expect(modal.locator('[data-testid="incident-summary"]')).not.toBeVisible();
    }
  });
  
  test('Chat with Price button passes date context', async ({ page }) => {
    const dayWithTrades = page.locator('[data-testid="calendar-day"][data-has-trades="true"]').first();
    
    if (await dayWithTrades.count() > 0) {
      await dayWithTrades.click();
      await page.click('[data-testid="chat-with-price-button"]');
      
      // Should navigate to Price chat
      await expect(page.locator('[data-testid="price-chat"]')).toBeVisible();
      
      // Should show context banner
      await expect(page.locator('[data-testid="chat-context-banner"]')).toBeVisible();
    }
  });
});
```

### D) Econ Calendar Tests

**File: `e2e/econ.spec.ts`**

```typescript
test.describe('Econ Calendar Section', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');
    await page.click('[data-testid="nav-econ"]');
  });
  
  test('displays simple local calendar and TradingView iframe', async ({ page }) => {
    await expect(page.locator('[data-testid="econ-local-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="econ-tradingview-iframe"]')).toBeVisible();
  });
  
  test('local calendar is non-clickable', async ({ page }) => {
    const localCalendar = page.locator('[data-testid="econ-local-calendar"]');
    
    // Try to click a day
    const day = localCalendar.locator('[data-testid="calendar-day"]').first();
    
    // Should not open any modal or trigger navigation
    await day.click();
    await expect(page.locator('[data-testid="day-detail-modal"]')).not.toBeVisible();
  });
  
  test('Interpret Today button triggers backend interpretation', async ({ page }) => {
    // Mock the API response
    await page.route('**/api/econ/interpret', async (route) => {
      await route.fulfill({
        status: 200,
        json: { jobId: 'test-123', status: 'completed', message: 'Plan extracted' },
      });
    });
    
    await page.route('**/api/econ/day/*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          date: '2025-12-15',
          plan: 'Test macro plan summary',
          events: [
            { time: '10:00', currency: 'USD', impact: 'high', title: 'CPI Release' },
          ],
          source: 'tradingview_screenshot',
        },
      });
    });
    
    await page.click('[data-testid="econ-interpret-button"]');
    
    // Should show loading state
    await expect(page.locator('[data-testid="econ-interpret-loading"]')).toBeVisible();
    
    // Wait for plan to appear
    await expect(page.locator('[data-testid="econ-plan-display"]')).toBeVisible({ timeout: 5000 });
    
    // Plan should be displayed
    await expect(page.locator('[data-testid="econ-plan-text"]')).toContainText('Test macro plan');
  });
  
  test('NewsPlanForDay appears in RiskFlow KPI Card4', async ({ page }) => {
    // Navigate to RiskFlow
    await page.click('[data-testid="nav-riskflow"]');
    
    const card4 = page.locator('[data-testid="kpi-card-4"]');
    await expect(card4).toBeVisible();
    
    // Should show news plan ticker
    await expect(card4.locator('[data-testid="news-plan-ticker"]')).toBeVisible();
  });
});
```

### E) Panel Collapse Tests

**File: `e2e/panel-collapse.spec.ts`**

```typescript
test.describe('Panel Collapse Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');
  });
  
  test('left panel collapses horizontally from side', async ({ page }) => {
    const leftPanel = page.locator('[data-testid="left-panel"]');
    const initialBox = await leftPanel.boundingBox();
    const initialWidth = initialBox!.width;
    
    // Click collapse button
    await page.click('[data-testid="left-panel-collapse"]');
    
    // Wait for animation (200ms)
    await page.waitForTimeout(250);
    
    const collapsedBox = await leftPanel.boundingBox();
    
    // Width should decrease (horizontal collapse)
    expect(collapsedBox!.width).toBeLessThan(initialWidth);
    
    // Height should remain the same (NOT vertical collapse)
    expect(collapsedBox!.height).toBe(initialBox!.height);
  });
  
  test('right panel collapses horizontally from side', async ({ page }) => {
    const rightPanel = page.locator('[data-testid="right-panel"]');
    const initialBox = await rightPanel.boundingBox();
    
    await page.click('[data-testid="right-panel-collapse"]');
    await page.waitForTimeout(250);
    
    const collapsedBox = await rightPanel.boundingBox();
    expect(collapsedBox!.width).toBeLessThan(initialBox!.width);
    expect(collapsedBox!.height).toBe(initialBox!.height);
  });
});
```

---

## 4.3 Electron Desktop App

### A) Project Setup

```bash
mkdir pulse-desktop && cd pulse-desktop
npm init -y
npm install electron
npm install -D electron-builder typescript @types/node tsx
```

### B) Package.json

```json
{
  "name": "pulse-desktop",
  "version": "1.0.0",
  "description": "Pulse Trading Platform - Desktop App",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "tsx watch src/main/index.ts",
    "build": "tsc",
    "dist": "npm run build && electron-builder",
    "dist:mac": "npm run build && electron-builder --mac"
  },
  "build": {
    "appId": "io.solvys.pulse",
    "productName": "Pulse",
    "directories": {
      "output": "release",
      "buildResources": "resources"
    },
    "mac": {
      "category": "public.app-category.finance",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "resources/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "dmg": {
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    }
  }
}
```

### C) Main Process

**File: `src/main/index.ts`**

```typescript
import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';

const PULSE_URL = 'https://pulse.solvys.io';

let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Pulse',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(PULSE_URL);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
  
  // Create menu
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
  
  Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
```

### D) Build DMG

```bash
npm run dist:mac
# Output: release/Pulse-1.0.0-arm64.dmg
```

---

## 4.4 Phase 4 Exit Criteria

- All integration tests pass (>95% coverage)
- All E2E tests pass on Chrome and Safari
- Navigation peek/pin sidebar works correctly
- RiskFlow KPI row displays correct cards (selected instrument + news plan)
- Journal calendar tiles colored by P&L
- Day detail modal shows area-line charts (P&L + ER) with gradient fills
- No gradients on icons/cards (only in KPI charts)
- Panels collapse horizontally from sides only
- Econ calendar interpretation pipeline works end-to-end
- Electron app builds successfully
- DMG installs and runs on macOS
- No console errors in production
- UX is polished and feels modern/futuristic

---

## 4.5 Testing Checklist

### Integration Tests
- [ ] Journal stats endpoint
- [ ] Journal calendar endpoint
- [ ] Journal date detail endpoint
- [ ] ER scores endpoint
- [ ] Blindspot rating endpoint
- [ ] Econ interpretation endpoint
- [ ] Econ cached plan endpoint

### E2E Tests
- [ ] Navigation rail + peek/pin sidebar
- [ ] Section switching (Tape/Price/RiskFlow/Journal/Econ)
- [ ] RiskFlow KPI row (4 cards, correct order)
- [ ] Journal calendar tile coloring
- [ ] Day detail modal (area charts, no incident summary)
- [ ] Chat with Price context passing
- [ ] Econ calendar iframe + interpretation
- [ ] Panel horizontal collapse
- [ ] Layout modes (Combined/TickersOnly/Moveable)

### Electron
- [ ] App builds
- [ ] DMG packages correctly
- [ ] App loads Vercel frontend
- [ ] Native menu works
- [ ] External links open in browser
