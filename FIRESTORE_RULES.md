# Firestore Security Rules Guide

## Current Rules (Development Only - Expires Dec 13, 2025)

Your current rules allow all read/write access until December 13, 2025. This is NOT suitable for production.

## Recommended Security Rules

Replace your `firestore.rules` file with these production-ready rules:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Stocks collection - read-only for all users
    // Only Cloud Functions can write (using Admin SDK)
    match /stocks/{stockId} {
      allow read: if true;  // Anyone can read stock data
      allow write: if false; // Only Cloud Functions can write
    }

    // User portfolios - authenticated users only
    match /users/{userId}/portfolio/{stockId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // User watchlists - authenticated users only
    match /users/{userId}/watchlist/{stockId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // API usage tracking - read-only for authenticated users
    match /apiUsage/{usageId} {
      allow read: if request.auth != null;
      allow write: if false; // Only Cloud Functions can write
    }

    // Deny all other access by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Rule Breakdown

### Stocks Collection

- **READ**: Public access - anyone can search and view stocks
- **WRITE**: Admin only - Cloud Functions populate this data

### User Data (portfolio, watchlist)

- **READ/WRITE**: Authenticated users can only access their own data
- Uses `request.auth.uid == userId` to verify ownership

### API Usage Tracking

- **READ**: Authenticated users can view
- **WRITE**: Admin only - Cloud Functions track usage

## Testing Your Rules

Use the Firebase Console Rules Simulator:

1. Go to Firebase Console > Firestore > Rules
2. Click "Rules playground"
3. Test different scenarios:
   - Authenticated read on `/stocks/AAPL`
   - Unauthenticated read on `/stocks/AAPL`
   - Authenticated write on `/users/{uid}/portfolio/AAPL`

## Deploying Rules

```bash
firebase deploy --only firestore:rules
```

## Future Enhancements

When you add user authentication:

```
// Premium features - only for premium users
match /users/{userId}/premiumData/{document=**} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId
    && get(/databases/$(database)/documents/users/$(userId)).data.isPremium == true;
}

// Admin-only collection
match /admin/{document=**} {
  allow read, write: if request.auth != null
    && request.auth.token.admin == true;
}
```

## Best Practices

1. **Never allow unrestricted write access** - Always verify authentication
2. **Validate data** - Add field validation in rules
3. **Limit document size** - Prevent abuse with size limits
4. **Use subcollections** - Better organization and security
5. **Test thoroughly** - Use the Rules playground before deploying

## Example: Field Validation

```
match /users/{userId}/portfolio/{stockId} {
  allow create: if request.auth != null
    && request.auth.uid == userId
    && request.resource.data.keys().hasAll(['symbol', 'shares', 'purchasePrice'])
    && request.resource.data.shares is number
    && request.resource.data.shares > 0
    && request.resource.data.purchasePrice is number
    && request.resource.data.purchasePrice > 0;
}
```

This ensures portfolio entries have required fields with valid values.

## Resources

- [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Rules Reference](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Testing Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
