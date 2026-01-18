# Cleaning Firestore Data

This guide explains how to clean/delete data from Firestore collections.

## Collections Used

- **`runs`** - Game run data (used for stats and leaderboard)
- **`sessions`** - Session data (for class sessions)
- **`sessions/{sessionId}/players`** - Player data in sessions
- **`sessions/{sessionId}/selections`** - Player selections in sessions

## Method 1: Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **terminate-trap**
3. Navigate to **Firestore Database**
4. Click on the **`runs`** collection
5. Select all documents (check the checkbox at the top)
6. Click **Delete** button
7. Confirm deletion

**Note:** For large collections (>1000 docs), you may need to delete in batches.

## Method 2: Firebase CLI

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login
firebase login

# Use Firestore emulator or direct deletion (requires admin access)
# Note: CLI doesn't have a direct "delete all" command, so you'll need a script
```

## Method 3: Node.js Script (Recommended for Large Datasets)

### Setup

1. Install Firebase Admin SDK:
```bash
npm install firebase-admin
```

2. Get Service Account Key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file securely

3. Set environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Run the Script

```bash
node scripts/clean-runs.js
```

### Customize the Script

Edit `scripts/clean-runs.js` to:
- Delete specific collections
- Filter by date range
- Delete sessions and related data

## Method 4: Delete Specific Data (Filtered)

### Delete Old Runs (older than X days)

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function deleteOldRuns(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
  
  const runsRef = db.collection('runs');
  const snapshot = await runsRef
    .where('createdAt', '<', cutoffTimestamp)
    .get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`Deleted ${snapshot.size} runs older than ${daysOld} days`);
}
```

### Delete Runs by Session

```javascript
async function deleteRunsBySession(sessionId) {
  const runsRef = db.collection('runs');
  const snapshot = await runsRef
    .where('sessionId', '==', sessionId)
    .get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`Deleted ${snapshot.size} runs for session ${sessionId}`);
}
```

## Method 5: Using Firebase Console - Bulk Delete

For very large collections:

1. Use Firebase Console
2. Navigate to collection
3. Use pagination to delete in batches
4. Or use the script method above (handles batching automatically)

## Security Note

The Firestore security rules prevent client-side deletion (`allow delete: if false`), so you must use:
- Firebase Console (web UI)
- Firebase Admin SDK (server-side script)
- Firebase CLI with proper authentication

## Cleanup All Session Data

To clean up sessions and related data:

```javascript
async function deleteAllSessions() {
  const sessionsRef = db.collection('sessions');
  const snapshot = await sessionsRef.get();
  
  for (const doc of snapshot.docs) {
    const sessionId = doc.id;
    
    // Delete subcollections
    const playersRef = db.collection(`sessions/${sessionId}/players`);
    const playersSnapshot = await playersRef.get();
    const playersBatch = db.batch();
    playersSnapshot.docs.forEach(d => playersBatch.delete(d.ref));
    await playersBatch.commit();
    
    const selectionsRef = db.collection(`sessions/${sessionId}/selections`);
    const selectionsSnapshot = await selectionsRef.get();
    const selectionsBatch = db.batch();
    selectionsSnapshot.docs.forEach(d => selectionsBatch.delete(d.ref));
    await selectionsBatch.commit();
    
    // Delete session
    await doc.ref.delete();
  }
  
  console.log(`Deleted ${snapshot.size} sessions and related data`);
}
```
