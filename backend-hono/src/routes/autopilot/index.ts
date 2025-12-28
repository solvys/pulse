/**
 * Autopilot Routes
 * Main route registration for autopilot endpoints
 */

import { Hono } from 'hono';
import { handlePropose } from './handlers/propose.js';
import { handleAcknowledge } from './handlers/acknowledge.js';
import { handleListProposals, handleGetProposal } from './handlers/proposals.js';
import { handleExecute } from './handlers/execute.js';
import { handleStatus } from './handlers/status.js';
import { handleUpdateSettings } from './handlers/settings.js';
import { handleCorrelatedPairs } from './handlers/correlated-pairs.js';
import { handleDetectAntiLag } from './handlers/anti-lag.js';
import { handleTimeWindows } from './handlers/time-windows.js';

const autopilotRoutes = new Hono();

// POST /autopilot/propose - Create a trading proposal
autopilotRoutes.post('/propose', handlePropose);

// POST /autopilot/acknowledge - Approve/reject a proposal
autopilotRoutes.post('/acknowledge', handleAcknowledge);

// GET /autopilot/proposals - List user's proposals
autopilotRoutes.get('/proposals', handleListProposals);

// GET /autopilot/proposals/:id - Get proposal details
autopilotRoutes.get('/proposals/:id', handleGetProposal);

// POST /autopilot/execute - Execute approved proposal
autopilotRoutes.post('/execute', handleExecute);

// GET /autopilot/status - Get autopilot status and settings
autopilotRoutes.get('/status', handleStatus);

// POST /autopilot/settings - Update autopilot settings
autopilotRoutes.post('/settings', handleUpdateSettings);

// GET /autopilot/correlated-pairs - Get available correlated pairs
autopilotRoutes.get('/correlated-pairs', handleCorrelatedPairs);

// POST /autopilot/detect-anti-lag - Detect anti-lag
autopilotRoutes.post('/detect-anti-lag', handleDetectAntiLag);

// GET /autopilot/time-windows - Get configured time windows
autopilotRoutes.get('/time-windows', handleTimeWindows);

export { autopilotRoutes };
