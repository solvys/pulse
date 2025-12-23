# ProjectX API Documentation

This document contains the official ProjectX (TopStepX) Trading API documentation for integration with the Pulse Autopilot system.

## Place an Order

**API URL:** `POST https://api.topstepx.com/api/Order/place`

**API Reference:** `/api/Order/place`

**Description:** Place an order.

### Parameters

| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| accountId | integer | The account ID. | Required | false |
| contractId | string | The contract ID. | Required | false |
| type | integer | The order type:<br>1 = Limit<br>2 = Market<br>4 = Stop<br>5 = TrailingStop<br>6 = JoinBid<br>7 = JoinAsk | Required | false |
| side | integer | The side of the order:<br>0 = Bid (buy)<br>1 = Ask (sell) | Required | false |
| size | integer | The size of the order. | Required | false |
| limitPrice | decimal | The limit price for the order, if applicable. | Optional | true |
| stopPrice | decimal | The stop price for the order, if applicable. | Optional | true |
| trailPrice | decimal | The trail price for the order, if applicable. | Optional | true |
| customTag | string | An optional custom tag for the order. Must be unique across the account. | Optional | true |
| stopLossBracket | object | Stop loss bracket configuration. | Optional | true |
| takeProfitBracket | object | Take profit bracket configuration. | Optional | true |

### Bracket Objects

#### stopLossBracket
| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| ticks | integer | Number of ticks for stop loss | Required | false |
| type | integer | Type of stop loss bracket. Uses same OrderType enum values:<br>1 = Limit<br>2 = Market<br>4 = Stop<br>5 = TrailingStop<br>6 = JoinBid<br>7 = JoinAsk | Required | false |

#### takeProfitBracket
| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| ticks | integer | Number of ticks for take profit | Required | false |
| type | integer | Type of take profit bracket. Uses same OrderType enum values:<br>1 = Limit<br>2 = Market<br>4 = Stop<br>5 = TrailingStop<br>6 = JoinBid<br>7 = JoinAsk | Required | false |

### Example Usage

**Example Request**
```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Order/place' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": 465,
    "contractId": "CON.F.US.DA6.M25",
    "type": 2,
    "side": 1,
    "size": 1,
    "limitPrice": null,
    "stopPrice": null,
    "trailPrice": null,
    "customTag": null,
    "stopLossBracket": {
      "ticks": 10,
      "type": 1
    },
    "takeProfitBracket": {
      "ticks": 20,
      "type": 1
    }
  }'
```

**Example Response (Success)**
```json
{
    "orderId": 9056,
    "success": true,
    "errorCode": 0,
    "errorMessage": null
}
```

**Example Response (Error)**
```json
{
  "status": 401
}
```

## Modify an Order

**API URL:** `POST https://api.topstepx.com/api/Order/modify`

**API Reference:** `/api/Order/modify`

**Description:** Modify an open order.

### Parameters

| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| accountId | integer | The account ID. | Required | false |
| orderId | integer | The order id. | Required | false |
| size | integer | The size of the order. | Optional | true |
| limitPrice | decimal | The limit price for the order, if applicable. | Optional | true |
| stopPrice | decimal | The stop price for the order, if applicable. | Optional | true |
| trailPrice | decimal | The trail price for the order, if applicable. | Optional | true |

### Example Usage

**Example Request**
```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Order/modify' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": 465,
    "orderId": 26974,
    "size": 1,
    "limitPrice": null,
    "stopPrice": 1604,
    "trailPrice": null
  }'
```

**Example Response (Success)**
```json
{
    "success": true,
    "errorCode": 0,
    "errorMessage": null
}
```

**Example Response (Error)**
```json
{
  "status": 401
}
```

## Search for Open Orders

**API URL:** `POST https://api.topstepx.com/api/Order/searchOpen`

**API Reference:** `/api/Order/searchOpen`

**Description:** Search for open orders.

### Parameters

| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| accountId | integer | The account ID. | Required | false |

### Example Usage

**Example Request**
```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Order/searchOpen' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": 212
  }'
```

**Example Response (Success)**
```json
{
    "orders": [
        {
            "id": 26970,
            "accountId": 212,
            "contractId": "CON.F.US.EP.M25",
            "creationTimestamp": "2025-04-21T19:45:52.105808+00:00",
            "updateTimestamp": "2025-04-21T19:45:52.105808+00:00",
            "status": 1,
            "type": 4,
            "side": 1,
            "size": 1,
            "limitPrice": null,
            "stopPrice": 5138.000000000,
            "filledPrice": null
        }
    ],
    "success": true,
    "errorCode": 0,
    "errorMessage": null
}
```

**Example Response (Error)**
```json
{
  "status": 401
}
```

## Search for Positions

**API URL:** `POST https://api.topstepx.com/api/Position/searchOpen`

**API Reference:** `/api/Position/searchOpen`

**Description:** Search for open positions.

### Parameters

| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| accountId | integer | The account ID. | Required | false |

### Example Usage

**Example Request**
```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Position/searchOpen' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": 536
  }'
```

**Example Response (Success)**
```json
{
    "positions": [
        {
            "id": 6124,
            "accountId": 536,
            "contractId": "CON.F.US.GMET.J25",
            "creationTimestamp": "2025-04-21T19:52:32.175721+00:00",
            "type": 1,
            "size": 2,
            "averagePrice": 1575.750000000
        }
    ],
    "success": true,
    "errorCode": 0,
    "errorMessage": null
}
```

## Close Positions

**API URL:** `POST https://api.topstepx.com/api/Position/closeContract`

**API Reference:** `/api/Position/closeContract`

**Description:** Close a position.

### Parameters

| Name | Type | Description | Required | Nullable |
|------|------|-------------|----------|----------|
| accountId | integer | The account ID. | Required | false |
| contractId | string | The contract ID. | Required | false |

### Example Usage

**Example Request**
```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Position/closeContract' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": 536,
    "contractId": "CON.F.US.GMET.J25"
  }'
```

**Example Response (Success)**
```json
{
    "success": true,
    "errorCode": 0,
    "errorMessage": null
}
```

## Real Time Data Overview

The ProjectX Real Time API utilizes SignalR library (via WebSocket) to provide real-time access to data updates involving accounts, orders, positions, balances and quotes.

There are two hubs: **user** and **market**.

The **user hub** will provide real-time updates to a user's accounts, orders, and positions.
The **market hub** will provide market data such as market trade events, DOM events, etc.

### What is SignalR?

SignalR is a real-time web application framework developed by Microsoft that simplifies the process of adding real-time functionality to web applications. It allows for bidirectional communication between clients (such as web browsers) and servers, enabling features like live chat, notifications, and real-time updates without the need for constant client-side polling or manual handling of connections.

SignalR abstracts away the complexities of real-time communication by providing high-level APIs for developers. It supports various transport protocols, including WebSockets, Server-Sent Events (SSE), Long Polling, and others, automatically selecting the most appropriate transport mechanism based on the capabilities of the client and server.

The framework handles connection management, message routing, and scaling across multiple servers, making it easier for developers to build scalable and responsive web applications. SignalR is available for multiple platforms, including .NET and JavaScript, allowing developers to build real-time applications using their preferred programming languages and frameworks.

Further information on SignalR can be found [here](https://dotnet.microsoft.com/en-us/apps/aspnet/signalr).

## Rate Limits

The Gateway API employs a rate limiting system for all authenticated requests. Its goal is to promote fair usage, prevent abuse, and ensure the stability and reliability of the service, while clearly defining the level of performance clients can expect.

### Rate Limit Table

| Endpoint(s) | Limit |
|-------------|-------|
| POST /api/History/retrieveBars | 50 requests / 30 seconds |
| All other Endpoints | 200 requests / 60 seconds |

### What Happens If You Exceed Rate Limits?

If you exceed the allowed rate limits, the API will respond with an HTTP **429 Too Many Requests** error. When this occurs, you should reduce your request frequency and try again after a short delay.

## Enum Definitions

### OrderSide
```typescript
enum OrderSide {
    Bid = 0,
    Ask = 1
}
```

### OrderType
```typescript
enum OrderType {
    Unknown      = 0,
    Limit        = 1,
    Market       = 2,
    StopLimit    = 3,
    Stop         = 4,
    TrailingStop = 5,
    JoinBid      = 6,
    JoinAsk      = 7,
}
```

### OrderStatus
```typescript
enum OrderStatus {
    None      = 0,
    Open      = 1,
    Filled    = 2,
    Cancelled = 3,
    Expired   = 4,
    Rejected  = 5,
    Pending   = 6
}
```

### PositionType
```typescript
enum PositionType {
    Undefined = 0,
    Long      = 1,
    Short     = 2
}
```

### TradeLogType
```typescript
enum TradeLogType {
    Buy  = 0,
    Sell = 1,
}
```

### DomType
```typescript
enum DomType {
    Unknown    = 0,
    Ask        = 1,
    Bid        = 2,
    BestAsk    = 3,
    BestBid    = 4,
    Trade      = 5,
    Reset      = 6,
    Low        = 7,
    High       = 8,
    NewBestBid = 9,
    NewBestAsk = 10,
    Fill       = 11,
}
```