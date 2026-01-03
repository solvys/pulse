import { tool } from 'ai';
import { z } from 'zod';
export const getTools = () => ({
    show_chart: tool({
        description: 'Show a futures chart for a given symbol',
        inputSchema: z.object({
            symbol: z.string().describe('The symbol to show chart for (e.g. NQ1!, ES1!)'),
        }),
        execute: async ({ symbol }) => {
            return { widget: 'chart', data: { symbol } };
        },
    }),
    show_calendar: tool({
        description: 'Show the economic calendar for risk events',
        inputSchema: z.object({}),
        execute: async () => {
            return { widget: 'calendar' };
        },
    }),
});
//# sourceMappingURL=tools.js.map