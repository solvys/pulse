import { projectxRoutes } from './projectx.js';
import { tradingRoutes } from './trading.js';
import { marketRoutes } from './market.js';
import { riskflowRoutes } from './riskflow.js';
import { journalRoutes } from './journal.js';
import { erRoutes } from './er.js';
import { econRoutes } from './econ.js';
import { accountRoutes } from './account.js';
import { notificationsRoutes } from './notifications.js';
import { eventsRoutes } from './events.js';
import { polymarketRoutes } from './polymarket.js';
import { aiRoutes } from './ai/index.js';
import { chatRoute } from './ai/chat.js';
import { adminRoutes } from './admin.js';
export function registerRoutes(app, includePublicRoutes = true) {
    app.route('/api/account', accountRoutes);
    app.route('/api/projectx', projectxRoutes);
    app.route('/api/trading', tradingRoutes);
    if (includePublicRoutes) {
        app.route('/api/market', marketRoutes);
    }
    app.route('/api/riskflow', riskflowRoutes);
    app.route('/api/journal', journalRoutes);
    app.route('/api/er', erRoutes);
    app.route('/api/econ', econRoutes);
    app.route('/api/notifications', notificationsRoutes);
    app.route('/api/events', eventsRoutes);
    app.route('/api/polymarket', polymarketRoutes);
    app.route('/api/ai', aiRoutes);
    app.route('/api/chat', chatRoute); // Shim for default AI SDK calls
    app.route('/api/admin', adminRoutes);
}
//# sourceMappingURL=index.js.map