/**
 * AI Route Schemas
 * Validation schemas for AI API endpoints
 */
import { z } from 'zod';
export declare const chatRequestSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
        parts: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant" | "system";
        content: string;
        id?: string | undefined;
        parts?: any[] | undefined;
    }, {
        role: "user" | "assistant" | "system";
        content: string;
        id?: string | undefined;
        parts?: any[] | undefined;
    }>, "many">;
    conversationId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodEnum<["grok-4", "claude-opus-4", "claude-sonnet-4.5"]>>;
}, "strip", z.ZodTypeAny, {
    messages: {
        role: "user" | "assistant" | "system";
        content: string;
        id?: string | undefined;
        parts?: any[] | undefined;
    }[];
    model?: "grok-4" | "claude-opus-4" | "claude-sonnet-4.5" | undefined;
    conversationId?: string | undefined;
}, {
    messages: {
        role: "user" | "assistant" | "system";
        content: string;
        id?: string | undefined;
        parts?: any[] | undefined;
    }[];
    model?: "grok-4" | "claude-opus-4" | "claude-sonnet-4.5" | undefined;
    conversationId?: string | undefined;
}>;
export declare const scoreRequestSchema: z.ZodObject<{
    symbol: z.ZodOptional<z.ZodString>;
    instrument: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol?: string | undefined;
    instrument?: string | undefined;
}, {
    symbol?: string | undefined;
    instrument?: string | undefined;
}>;
export declare const historySchema: z.ZodObject<{
    symbol: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    symbol?: string | undefined;
}, {
    symbol?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const conversationRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
}, {
    title?: string | undefined;
}>;
export declare const threatAnalyzeSchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    includeAnalysis: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    startDate?: string | undefined;
    endDate?: string | undefined;
    includeAnalysis?: boolean | undefined;
}, {
    startDate?: string | undefined;
    endDate?: string | undefined;
    includeAnalysis?: boolean | undefined;
}>;
export declare const blindSpotSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    id?: string | undefined;
    severity?: "high" | "medium" | "low" | undefined;
}, {
    name: string;
    description?: string | undefined;
    id?: string | undefined;
    severity?: "high" | "medium" | "low" | undefined;
}>;
//# sourceMappingURL=schemas.d.ts.map