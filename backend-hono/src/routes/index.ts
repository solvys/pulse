import { Hono } from 'hono';
import { projectxRoutes } from './projectx.js';
import { tradingRoutes } from './trading.js';
import { marketRoutes } from './market.js';
import { newsRoutes } from './news.js';
import { ivScoringRoutes } from './iv-scoring.js';
import { journalRoutes } from './journal.js';
import { erRoutes } from './er.js';
import { econRoutes } from './econ.js';
import { accountRoutes } from './account.js';
import { notificationsRoutes } from './notifications.js';
import { aiRoutes } from './ai.js';

export function registerRoutes(app: Hono) {
  app.route('/account', accountRoutes);
  app.route('/projectx', projectxRoutes);
  app.route('/trading', tradingRoutes);
  app.route('/market', marketRoutes);
  app.route('/news', newsRoutes);
  app.route('/iv-scoring', ivScoringRoutes);
  app.route('/journal', journalRoutes);
  app.route('/er', erRoutes);
  app.route('/econ', econRoutes);
  app.route('/notifications', notificationsRoutes);
  app.route('/ai', aiRoutes);
}
