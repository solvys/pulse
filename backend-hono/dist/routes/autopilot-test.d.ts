/**
 * Autopilot Test Routes
 *
 * Isolated test environment for autopilot system.
 * Uses test ProjectX credentials and test database tables.
 * Environment variable: AUTOPILOT_TEST_MODE=true
 */
import { Hono } from 'hono';
declare const autopilotTestRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export { autopilotTestRoutes };
//# sourceMappingURL=autopilot-test.d.ts.map