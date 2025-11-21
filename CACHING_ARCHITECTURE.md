# Stock Price Caching Architecture

## Overview

The stock price system now implements intelligent caching to minimize Alpha Vantage API calls while providing fast responses to users. The system uses Firestore subcollections to store price data at multiple granularities.

## Firestore Structure

```
stocks (collection)
├── AAPL (document)
│   ├── symbol: "AAPL"
│   ├── name: "Apple Inc"
│   ├── type: "Equity"
│   ├── region: "United States"
│   ├── currency: "USD"
│   ├── ... (other metadata)
│   │
│   └── prices (subcollection) ⭐
│       ├── intraday_2025-11-21 (document)
│       │   ├── date: "2025-11-21"
│       │   ├── interval: "15min"
│       │   ├── symbol: "AAPL"
│       │   ├── lastUpdated: Timestamp
│       │   └── candles: [
│       │       { time, open, high, low, close, volume },
│       │       ...
│       │   ]
│       │
│       ├── intraday_2025-11-20 (document)
│       │   └── ... (previous day's data)
│       │
│       ├── daily (document)
│       │   ├── symbol: "AAPL"
│       │   ├── granularity: "daily"
│       │   ├── lastUpdated: Timestamp
│       │   └── prices: {
│       │       "2025-11-21": { time, open, high, low, close, volume },
│       │       "2025-11-20": { time, open, high, low, close, volume },
│       │       ... (up to 730 days / 2 years)
│       │   }
│       │
│       ├── weekly (document)
│       │   ├── symbol: "AAPL"
│       │   ├── granularity: "weekly"
│       │   ├── lastUpdated: Timestamp
│       │   └── prices: {
│       │       "2025-W47": { time, open, high, low, close, volume },
│       │       "2025-W46": { time, open, high, low, close, volume },
│       │       ... (up to 104 weeks / 2 years)
│       │   }
│       │
│       └── monthly (document)
│           ├── symbol: "AAPL"
│           ├── granularity: "monthly"
│           ├── lastUpdated: Timestamp
│           └── prices: {
│               "2025-11": { time, open, high, low, close, volume },
│               "2025-10": { time, open, high, low, close, volume },
│               ... (up to 24 months / 2 years)
│           }
```

## Cache TTL (Time To Live)

### Intraday Cache

- **During market hours (9:30 AM - 4:00 PM ET)**: 15 minutes
- **After market close**: 24 hours
- **Document naming**: `intraday_YYYY-MM-DD`
- **Auto-cleanup**: Documents older than 7 days can be deleted

### Aggregate Caches

- **Daily**: 24 hours
- **Weekly**: 7 days
- **Monthly**: 30 days

## Caching Flow

### `getIntradayPrices` Function

```
1. User requests intraday prices for AAPL
   ↓
2. Check cache: stocks/AAPL/prices/intraday_2025-11-21
   ↓
3a. Cache HIT & FRESH
    → Return cached data immediately
    → API call saved! ✅

3b. Cache MISS or STALE
    → Fetch from Alpha Vantage API
    → Store in: stocks/AAPL/prices/intraday_2025-11-21
    → Aggregate to daily candle
    → Update: stocks/AAPL/prices/daily.prices.2025-11-21
    → Return data to user
```

### `getRecentOpenDay` Function

```
1. User requests recent open day for AAPL
   ↓
2. Check cache: stocks/AAPL/prices/intraday_2025-11-21
   ↓
3a. Cache HIT & FRESH
    → Filter for latest trading day
    → Return cached data

3b. Cache MISS or STALE
    → Fetch from Alpha Vantage API
    → Cache intraday data
    → Update daily aggregate
    → Return data to user
```

## Data Granularity Strategy

### 1 Day (1D)

- **Source**: Intraday cache (`intraday_YYYY-MM-DD`)
- **Granularity**: 15-minute candles
- **Data points**: ~26 candles (6.5 hours of trading)

### 5 Days (5D)

- **Source**: Daily cache
- **Granularity**: Daily OHLC
- **Data points**: 5 candles (1 per trading day)

### 1 Month (1M)

- **Source**: Daily cache
- **Granularity**: Daily OHLC
- **Data points**: ~21 candles (trading days in a month)

### 6 Months (6M)

- **Source**: Weekly cache
- **Granularity**: Weekly OHLC (aggregated from daily)
- **Data points**: ~26 candles (1 per week)

### 1 Year (1Y) & 2 Years (2Y)

- **Source**: Monthly cache
- **Granularity**: Monthly OHLC (aggregated from daily)
- **Data points**: 12 or 24 candles (1 per month)

### Year To Date (YTD)

- **Source**: Daily cache (if < 6 months) OR Weekly cache
- **Granularity**: Adaptive based on time span
- **Data points**: Variable

## Aggregation Logic

### Daily Aggregation

When intraday data is fetched, it's automatically aggregated to a single daily candle:

```typescript
{
  open: first_candle.open,
  high: max(all_candles.high),
  low: min(all_candles.low),
  close: last_candle.close,
  volume: sum(all_candles.volume)
}
```

### Weekly Aggregation

Daily candles are grouped by ISO week number and aggregated.

### Monthly Aggregation

Daily candles are grouped by month (YYYY-MM) and aggregated.

## API Call Optimization

### Without Caching (Before)

- 100 users × 5 stocks × 3 refreshes/day = **1,500 API calls/day**
- Exceeds free tier limit (500/day) ❌

### With Caching (After)

- First user: API call → cache it
- Next 99 users: Serve from cache ✅
- **Reduction**: 1,500 → ~100 API calls/day (93% reduction!)

## Cache Invalidation

### Automatic Freshness Checks

Every cache read checks `lastUpdated` timestamp:

- If age > TTL → fetch fresh data
- If age ≤ TTL → serve from cache

### Market-Aware TTL

During market hours:

- Intraday data refreshes every 15 minutes
- Ensures users see near-real-time prices

After market close:

- Intraday data cached for 24 hours
- No unnecessary API calls when market is closed

## Benefits

### Performance

- ⚡ **Fast responses**: Firestore reads < 100ms
- ⚡ **Reduced latency**: No external API calls for cached data

### Cost Efficiency

- 💰 **API rate limits**: Stay within 5 calls/min, 500 calls/day
- 💰 **Firestore reads**: Cheaper than API calls
- 💰 **Bandwidth**: Smaller payloads from cache

### Scalability

- 📈 **Concurrent users**: 100s of users can query same stock
- 📈 **Popular stocks**: AAPL, TSLA cached once, served many times
- 📈 **Historical data**: Long-term charts without repeated API calls

### User Experience

- ✨ **Instant charts**: No waiting for API responses
- ✨ **Smooth updates**: 15-min refresh during trading
- ✨ **Reliable**: Cache survives API rate limit errors

## Usage in iOS App

The Swift service remains unchanged:

```swift
// This now benefits from caching automatically!
let candles = try await StockPriceService.shared.fetchIntradayPrices(
    symbol: "AAPL",
    interval: "15min"
)

// First call: Fetches from API, caches result
// Second call (within 15 min): Serves from cache
// Result: Faster + fewer API calls
```

## Future Enhancements

### Potential Additions

1. **Background Jobs**: Scheduled function to pre-cache popular stocks
2. **Cleanup Jobs**: Delete old intraday documents (>7 days)
3. **Analytics**: Track cache hit rates
4. **User-specific**: Cache based on user watchlists

### Monitoring

- Track cache hit/miss ratio
- Monitor API call count
- Alert if approaching rate limits

## Example Firestore Documents

### Intraday Document

```json
{
  "date": "2025-11-21",
  "interval": "15min",
  "symbol": "AAPL",
  "lastUpdated": "2025-11-21T15:30:00Z",
  "candles": [
    {
      "time": "2025-11-21T09:30:00Z",
      "open": 150.25,
      "high": 151.1,
      "low": 150.0,
      "close": 150.8,
      "volume": 1250000
    }
    // ... more candles
  ]
}
```

### Daily Document

```json
{
  "symbol": "AAPL",
  "granularity": "daily",
  "lastUpdated": "2025-11-21T20:00:00Z",
  "prices": {
    "2025-11-21": {
      "time": "2025-11-21T09:30:00Z",
      "open": 150.25,
      "high": 152.5,
      "low": 149.8,
      "close": 151.75,
      "volume": 45000000
    },
    "2025-11-20": {
      "time": "2025-11-20T09:30:00Z",
      "open": 149.5,
      "high": 150.75,
      "low": 148.9,
      "close": 150.2,
      "volume": 42000000
    }
    // ... up to 730 days
  }
}
```

## Summary

The caching system is now fully implemented with:

- ✅ Read-through lazy loading
- ✅ Multiple granularities (intraday, daily, weekly, monthly)
- ✅ Smart TTL based on market hours
- ✅ Automatic aggregation (intraday → daily)
- ✅ Zero changes to client-facing API
- ✅ Massive reduction in API calls
- ✅ Production-ready with proper error handling

Users will see **faster responses** and the app will **stay within API rate limits** even with hundreds of active users!
