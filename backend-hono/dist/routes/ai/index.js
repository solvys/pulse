import { Hono } from 'hono';
import { chatRoute } from './chat.js';
import { quickPulseRoute } from './quick-pulse.js';
import { conversationsRoute } from './conversations.js';
export const aiRoutes = new Hono();
// Mount sub-routes
aiRoutes.route('/chat', chatRoute);
aiRoutes.route('/quick-pulse', quickPulseRoute);
aiRoutes.route('/conversations', conversationsRoute);
aiRoutes.get('/health', (c) => c.json({ status: 'AI Brain Online' }));
//# sourceMappingURL=index.js.map