/**
 * Threat Handlers
 * Threat history and analysis endpoints
 */
import { Context } from 'hono';
export declare function handleGetThreatHistory(c: Context): Promise<(Response & import("hono").TypedResponse<{
    threats: {
        id: string;
        type: "overtrading" | "emotional" | "consecutive_losses";
        severity: "low" | "medium" | "high" | "critical";
        description: string;
        timestamp: string;
        metadata: {
            tradeCount?: number | undefined;
            usualCount?: number | undefined;
            dailyPnL?: number | undefined;
            consecutiveLosses?: number | undefined;
            consecutiveLosingDays?: number | undefined;
            blindSpotsTriggered?: string[] | undefined;
            timestamp?: string | undefined;
        };
    }[];
    analysis?: {
        summary: string;
        patterns: string[];
        recommendations: string[];
    } | undefined;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleAnalyzeThreats(c: Context): Promise<(Response & import("hono").TypedResponse<{
    threats: {
        id: string;
        type: "overtrading" | "emotional" | "consecutive_losses";
        severity: "low" | "medium" | "high" | "critical";
        description: string;
        timestamp: string;
        metadata: {
            tradeCount?: number | undefined;
            usualCount?: number | undefined;
            dailyPnL?: number | undefined;
            consecutiveLosses?: number | undefined;
            consecutiveLosingDays?: number | undefined;
            blindSpotsTriggered?: string[] | undefined;
            timestamp?: string | undefined;
        };
    }[];
    analysis?: {
        summary: string;
        patterns: string[];
        recommendations: string[];
    } | undefined;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            startDate?: string[] | undefined;
            endDate?: string[] | undefined;
            includeAnalysis?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    analysis: string;
    threats: {
        id: string;
        type: "overtrading" | "emotional" | "consecutive_losses";
        severity: "low" | "medium" | "high" | "critical";
        description: string;
        timestamp: string;
        metadata: {
            tradeCount?: number | undefined;
            usualCount?: number | undefined;
            dailyPnL?: number | undefined;
            consecutiveLosses?: number | undefined;
            consecutiveLosingDays?: number | undefined;
            blindSpotsTriggered?: string[] | undefined;
            timestamp?: string | undefined;
        };
    }[];
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=threat.d.ts.map