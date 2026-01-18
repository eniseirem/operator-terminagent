/**
 * Simple script to delete all runs from Firestore using Firebase Admin SDK
 * 
 * Quick Setup:
 *   1. npm install firebase-admin
 *   2. Download service account key from Firebase Console:
 *      - Project Settings → Service Accounts → Generate New Private Key
 *   3. Save as 'service-account-key.json' in project root
 *   4. Run: node scripts/clean-runs-simple.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account key
const serviceAccountPath = path.join(__dirname, '..', 'service-account-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ service-account-key.json not found!');
  console.error('\nTo get it:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save as service-account-key.json in project root');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deleteAllRuns() {
  try {
    console.log('📊 Fetching all runs from Firestore...');
    const runsRef = db.collection('runs');
    const snapshot = await runsRef.get();
    
    if (snapshot.empty) {
      console.log('✅ No runs found. Collection is already empty.');
      return;
    }
    
    console.log(`📦 Found ${snapshot.size} runs. Deleting in batches...`);
    
    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deleted = 0;
    let batchNum = 1;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deleted += batchDocs.length;
      console.log(`   Batch ${batchNum}: Deleted ${deleted}/${snapshot.size} runs`);
      batchNum++;
    }
    
    console.log(`\n✅ Successfully deleted all ${deleted} runs!`);
  } catch (error) {
    console.error('❌ Error deleting runs:', error);
    process.exit(1);
  }
}

// Run cleanup
console.log('🧹 Starting cleanup of runs collection...\n');
deleteAllRuns()
  .then(() => {
    console.log('\n✨ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
