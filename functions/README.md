# Stock Tracking Firebase Backend

A modular Firebase Cloud Functions backend for a stock tracking mobile application. This backend fetches stock data from Alpha Vantage API, caches it in Firestore, and provides efficient search endpoints.

## 🏗️ Architecture

```
functions/
├── src/
│   ├── index.ts                        # Entry point - exports all functions
│   ├── config.ts                       # Environment variables & configuration
│   ├── types/
│   │   └── stock.ts                    # TypeScript interfaces
│   ├── utils/
│   │   ├── logger.ts                   # Logging utilities
│   │   └── batching.ts                 # Firestore batch operations
│   ├── services/
│   │   ├── alphavantage.service.ts     # Alpha Vantage API integration
│   │   └── firestore.service.ts        # Firestore CRUD operations
│   └── functions/
│       ├── refreshStocks.ts            # Stock cache refresh (scheduled + manual)
│       └── searchStocks.ts             # Stock search endpoints
├── package.json
├── tsconfig.json
└── .eslintrc.js
```

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with services, utilities, and functions
- **Alpha Vantage Integration**: Fetch stock data from Alpha Vantage API
- **Firestore Caching**: Cache stock data to minimize API calls and improve performance
- **Rate Limit Handling**: Built-in delay mechanisms to respect API rate limits
- **Batch Operations**: Efficient Firestore batch writes for multiple stocks
- **Search Capabilities**: Search by symbol or company name with prefix matching
- **Scheduled Refresh**: Daily automatic cache refresh
- **Manual Refresh**: HTTP endpoint for on-demand cache updates
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## 📋 Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Firestore enabled
- Alpha Vantage API key (free tier available at https://www.alphavantage.co/support/#api-key)

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Secrets

Set your Alpha Vantage API key as a Firebase secret:

```bash
firebase functions:secrets:set ALPHA_VANTAGE_API_KEY
```

Set a refresh secret for manual trigger authentication:

```bash
firebase functions:secrets:set REFRESH_SECRET
```

### 3. Build the Project

```bash
npm run build
```

### 4. Test Locally (Optional)

```bash
npm run serve
```

This starts the Firebase emulators for local testing.

### 5. Deploy to Firebase

```bash
npm run deploy
```

## 📡 Available Cloud Functions

### 1. `refreshStockCache` (Scheduled)

Runs daily at 2 AM (America/New_York) to refresh stock data.

**Configuration**: Edit the schedule in `src/config.ts` (`CACHE_CONFIG.refreshSchedule`)

### 2. `triggerRefreshNow` (HTTP)

Manual trigger to refresh stock cache immediately.

**Endpoint**: `POST /triggerRefreshNow`

**Headers**:

```
X-Refresh-Secret: your_refresh_secret
```

**Response**:

```json
{
  "success": true,
  "message": "Stock cache refreshed successfully",
  "stocksProcessed": 7,
  "durationMs": 84123
}
```

### 3. `searchStocks` (HTTP)

Search for stocks by symbol or name.

**Endpoint**: `GET /searchStocks?q=AAPL&type=symbol&limit=10`

**Query Parameters**:

- `q` (required): Search query
- `type` (optional): "symbol" or "name" (default: "symbol")
- `limit` (optional): Max results (default: 10, max: 50)

**Response**:

```json
{
  "success": true,
  "query": "AAPL",
  "searchType": "symbol",
  "count": 1,
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "Equity",
      "region": "United States",
      "currency": "USD"
    }
  ]
}
```

### 4. `getStock` (HTTP)

Get detailed information about a specific stock.

**Endpoint**: `GET /getStock?symbol=AAPL`

**Query Parameters**:

- `symbol` (required): Stock symbol

**Response**:

```json
{
  "success": true,
  "result": {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "type": "Equity",
    "region": "United States",
    "currency": "USD",
    "lastUpdated": "2025-11-13T10:30:00.000Z"
  }
}
```

## 🔧 Configuration

### Stock Refresh List

Edit `src/functions/refreshStocks.ts` to customize which stocks to refresh:

```typescript
const popularStocks = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA"];
```

Or implement the `getWatchlistSymbols()` function to fetch from a Firestore collection.

### Rate Limiting

Alpha Vantage free tier limits:

- 5 requests per minute
- 500 requests per day

The refresh function includes a 12-second delay between requests to respect these limits.

### Cache TTL

Configure cache time-to-live in `src/config.ts`:

```typescript
export const CACHE_CONFIG = {
  stockDataTTL: 24 * 60 * 60 * 1000, // 24 hours
  refreshSchedule: "0 2 * * *", // Daily at 2 AM
};
```

## 🗃️ Firestore Collections

### `stocks` Collection

Document structure:

```typescript
{
  symbol: string; // Stock symbol (e.g., "AAPL")
  name: string; // Company name
  type: string; // "Equity", "ETF", etc.
  region: string; // "United States"
  currency: string; // "USD"
  searchSymbol: string; // Lowercase symbol for searching
  searchName: string; // Lowercase name for searching
  lastUpdated: Timestamp; // When data was last refreshed
}
```

## 📝 Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run build:watch
```

### Run Emulators

```bash
npm run serve
```

### Deploy

```bash
npm run deploy
```

### View Logs

```bash
npm run logs
```

## 🔍 Search Indexing

For efficient searching, the Firestore service creates lowercase search fields:

- `searchSymbol`: Lowercase version of the symbol
- `searchName`: Lowercase version of the company name

Prefix queries use these fields for case-insensitive searching.

## 🛡️ Security

- **CORS enabled** on search endpoints for frontend access
- **Secret-based authentication** for manual refresh trigger
- **Method validation** (GET-only for search endpoints)
- **Input validation** for all query parameters

## 📱 Integration with Mobile App

Your mobile app can call these endpoints:

```typescript
// Search for stocks
const response = await fetch(
  `https://your-region-your-project.cloudfunctions.net/searchStocks?q=AAPL`
);
const data = await response.json();

// Get specific stock
const stockResponse = await fetch(
  `https://your-region-your-project.cloudfunctions.net/getStock?symbol=AAPL`
);
const stockData = await stockResponse.json();
```

## 🚧 Future Enhancements

- [ ] Real-time stock price updates
- [ ] User portfolio management
- [ ] Transaction history
- [ ] Performance analytics
- [ ] Watchlist per user
- [ ] Price alerts
- [ ] Historical price data
- [ ] Rate limiting tracking in Firestore

## 📄 License

Private project

## 👤 Author

blackmaskexe
