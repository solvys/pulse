/**
 * Blind Spots Handlers
 * Blind spot management endpoints
 */
import { Context } from 'hono';
export declare function handleGetBlindSpots(c: Context): Promise<(Response & import("hono").TypedResponse<{
    blindSpots: {
        id: string;
        name: string;
        isGuardRailed: boolean;
        isActive: boolean;
        category: "behavioral" | "risk" | "execution" | "custom";
        source: "ai" | "user";
        createdAt: string;
        updatedAt?: string | undefined;
    }[];
    columns: {
        column1: {
            id: string;
            name: string;
            isGuardRailed: boolean;
            isActive: boolean;
            category: "behavioral" | "risk" | "execution" | "custom";
            source: "ai" | "user";
            createdAt: string;
            updatedAt?: string | undefined;
        }[];
        column2: {
            id: string;
            name: string;
            isGuardRailed: boolean;
            isActive: boolean;
            category: "behavioral" | "risk" | "execution" | "custom";
            source: "ai" | "user";
            createdAt: string;
            updatedAt?: string | undefined;
        }[];
        column3: {
            id: string;
            name: string;
            isGuardRailed: boolean;
            isActive: boolean;
            category: "behavioral" | "risk" | "execution" | "custom";
            source: "ai" | "user";
            createdAt: string;
            updatedAt?: string | undefined;
        }[];
    };
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleUpsertBlindSpot(c: Context): Promise<(Response & import("hono").TypedResponse<{
    error: string;
    details: {
        formErrors: string[];
        fieldErrors: {
            name?: string[] | undefined;
            id?: string[] | undefined;
            description?: string[] | undefined;
            severity?: string[] | undefined;
        };
    };
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    id: string;
    name: string;
    isGuardRailed: boolean;
    isActive: boolean;
    category: "behavioral" | "risk" | "execution" | "custom";
    source: "ai" | "user";
    createdAt: string;
    updatedAt?: string | undefined;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
export declare function handleDeleteBlindSpot(c: Context): Promise<(Response & import("hono").TypedResponse<{
    success: true;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 500, "json">)>;
//# sourceMappingURL=blind-spots.d.ts.map