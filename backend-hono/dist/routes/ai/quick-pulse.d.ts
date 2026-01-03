import { Hono } from 'hono';
type Variables = {
    user: {
        id: string;
    };
};
export declare const quickPulseRoute: Hono<{
    Variables: Variables;
}, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=quick-pulse.d.ts.map