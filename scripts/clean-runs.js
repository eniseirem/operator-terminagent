/**
 * Script to clean/delete all runs from Firestore
 * This requires Firebase Admin SDK and proper credentials
 * 
 * Usage:
 *   1. Install: npm install firebase-admin
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS env var or use service account
 *   3. Run: node scripts/clean-runs.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up credentials)
// Option 1: Use service account key file
// const serviceAccount = require('./path-to-service-account-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Option 2: Use environment variable GOOGLE_APPLICATION_CREDENTIALS
// Or use Application Default Credentials if running on GCP
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    console.error('\nPlease set up Firebase Admin credentials:');
    console.error('1. Download service account key from Firebase Console');
    console.error('2. Set GOOGLE_APPLICATION_CREDENTIALS env var, or');
    console.error('3. Pass serviceAccount to admin.initializeApp()');
    process.exit(1);
  }
}

const db = admin.firestore();

async function deleteAllRuns() {
  try {
    console.log('Fetching all runs...');
    const runsRef = db.collection('runs');
    const snapshot = await runsRef.get();
    
    if (snapshot.empty) {
      console.log('No runs found. Collection is already empty.');
      return;
    }
    
    console.log(`Found ${snapshot.size} runs. Deleting...`);
    
    // Delete in batches (Firestore limit is 500 per batch)
    const batchSize = 500;
    const batches = [];
    let currentBatch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref);
      count++;
      
      if (count % batchSize === 0) {
        batches.push(currentBatch);
        currentBatch = db.batch();
      }
    });
    
    // Add the last batch if it has any operations
    if (count % batchSize !== 0) {
      batches.push(currentBatch);
    }
    
    // Execute all batches
    console.log(`Executing ${batches.length} batch(es)...`);
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`Batch ${i + 1}/${batches.length} completed`);
    }
    
    console.log(`✅ Successfully deleted ${count} runs!`);
  } catch (error) {
    console.error('Error deleting runs:', error);
    process.exit(1);
  }
}

// Run the cleanup
deleteAllRuns()
  .then(() => {
    console.log('Cleanup complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
