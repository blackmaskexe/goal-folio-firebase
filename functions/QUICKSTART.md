# 🚀 Quick Start Guide

## Step 1: Get Alpha Vantage API Key

1. Visit https://www.alphavantage.co/support/#api-key
2. Enter your email to get a free API key
3. Save the API key - you'll need it in Step 3

## Step 2: Install Dependencies

```bash
cd functions
npm install
```

## Step 3: Configure Firebase Secrets

```bash
# Set your Alpha Vantage API key
firebase functions:secrets:set ALPHA_VANTAGE_API_KEY
# When prompted, paste your API key

# Set a refresh secret (use a random secure string)
firebase functions:secrets:set REFRESH_SECRET
# When prompted, enter a secure random string (e.g., generated from a password manager)
```

## Step 4: Build the Project

```bash
npm run build
```

## Step 5: Deploy to Firebase

```bash
npm run deploy
```

## Step 6: Test Your Functions

After deployment, Firebase will show you the URLs for your functions.

### Test the search endpoint:

```bash
curl "https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/searchStocks?q=AAPL"
```

### Trigger a manual refresh (replace YOUR_SECRET with your refresh secret):

```bash
curl -X POST \
  -H "X-Refresh-Secret: YOUR_SECRET" \
  "https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/triggerRefreshNow"
```

## Step 7: View Function Logs

```bash
firebase functions:log
```

Or view them in the Firebase Console: https://console.firebase.google.com

## 📱 Using from Your Mobile App

Add these endpoints to your mobile app:

**Search stocks:**

```
GET https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/searchStocks?q=AAPL&type=symbol&limit=10
```

**Get stock details:**

```
GET https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/getStock?symbol=AAPL
```

## 🔧 Customization

### Add More Stocks to Refresh

Edit `functions/src/functions/refreshStocks.ts`:

```typescript
const popularStocks = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA"];
// Add your stocks here
```

### Change Refresh Schedule

Edit `functions/src/config.ts`:

```typescript
export const CACHE_CONFIG = {
  refreshSchedule: "0 2 * * *", // Cron format: daily at 2 AM
};
```

## 🆘 Troubleshooting

### "Secret not found" error

Run `firebase functions:secrets:set ALPHA_VANTAGE_API_KEY` again

### "Rate limit exceeded"

The free tier allows 5 requests/minute. The refresh function includes delays to handle this.

### Functions won't deploy

- Ensure you're on the Blaze (pay-as-you-go) plan
- Check that Node version matches package.json (Node 22)
- Run `firebase login` to re-authenticate

### No search results

- Run the manual refresh first to populate Firestore
- Check Firebase Console > Firestore to see if documents exist

## 📊 Monitor Your Functions

- **Firebase Console**: https://console.firebase.google.com
- **Usage & Billing**: Monitor function invocations
- **Logs**: View real-time function logs
- **Firestore**: Check cached stock data

## 🎯 Next Steps

1. Set up Firestore indexes (if needed for complex queries)
2. Implement user authentication
3. Add user-specific watchlists
4. Implement portfolio tracking
5. Add real-time price updates
6. Set up monitoring and alerts

Happy coding! 🎉
