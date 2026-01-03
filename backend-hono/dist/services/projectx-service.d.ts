/**
 * ProjectX Service Wrapper for Autopilot
 *
 * This service wraps ProjectX API calls with exact API compliance.
 * Follows docs/integration/PROJECTX-API.md exactly.
 */
export declare enum OrderType {
    Limit = 1,
    Market = 2,
    StopLimit = 3,
    Stop = 4,
    TrailingStop = 5,
    JoinBid = 6,
    JoinAsk = 7
}
export declare enum OrderSide {
    Bid = 0,// Buy
    Ask = 1
}
export declare enum OrderStatus {
    None = 0,
    Open = 1,
    Filled = 2,
    Cancelled = 3,
    Expired = 4,
    Rejected = 5,
    Pending = 6
}
interface PlaceOrderRequest {
    accountId: number;
    contractId: string;
    type: OrderType;
    side: OrderSide;
    size: number;
    limitPrice?: number | null;
    stopPrice?: number | null;
    trailPrice?: number | null;
    customTag?: string | null;
    stopLossBracket?: {
        ticks: number;
        type: OrderType;
    } | null;
    takeProfitBracket?: {
        ticks: number;
        type: OrderType;
    } | null;
}
interface PlaceOrderResponse {
    orderId: number;
    success: boolean;
    errorCode: number;
    errorMessage: string | null;
}
/**
 * Place order via ProjectX API
 * Follows exact API specification from docs/integration/PROJECTX-API.md
 */
export declare function placeOrder(userId: string, orderRequest: PlaceOrderRequest): Promise<PlaceOrderResponse>;
/**
 * Search contracts by symbol
 */
export declare function searchContracts(userId: string, searchText: string, live?: boolean): Promise<Array<{
    id: string;
    name: string;
    description: string;
    tickSize: number;
    tickValue: number;
    activeContract: boolean;
    symbolId: string;
}>>;
export {};
//# sourceMappingURL=projectx-service.d.ts.map