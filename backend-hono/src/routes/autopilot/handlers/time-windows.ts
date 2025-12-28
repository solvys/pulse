/**
 * Time Windows Handler
 * Get configured time windows
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';

export async function handleTimeWindows(c: Context) {
  const userId = c.get('userId');

  try {
    const [settings] = await sql`
      SELECT 
        semi_autopilot_window as "semiAutopilotWindow",
        full_autopilot_window as "fullAutopilotWindow",
        placeholder_window_3 as "placeholderWindow3"
      FROM autopilot_settings
      WHERE user_id = ${userId}
    `;

    return c.json({
      semiAutopilotWindow: settings?.semiAutopilotWindow || null,
      fullAutopilotWindow: settings?.fullAutopilotWindow || null,
      placeholderWindow3: settings?.placeholderWindow3 || null,
    });
  } catch (error) {
    console.error('Failed to get time windows:', error);
    return c.json({ error: 'Failed to get time windows' }, 500);
  }
}
