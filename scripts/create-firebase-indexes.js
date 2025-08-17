const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function createIndexes() {
  try {
    console.log('Creating Firebase indexes...');
    
    // Create the composite index for user_activities collection
    const indexData = {
      collectionGroup: 'user_activities',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'walletAddress',
          order: 'ASCENDING'
        },
        {
          fieldPath: 'action',
          order: 'ASCENDING'
        },
        {
          fieldPath: 'articleSlug',
          order: 'ASCENDING'
        },
        {
          fieldPath: 'createdAt',
          order: 'ASCENDING'
        }
      ]
    };

    // Note: This will create the index in the Firebase console
    // You'll need to manually create it in the Firebase Console
    // Go to: https://console.firebase.google.com/v1/r/project/homebase-dapp/firestore/indexes
    // And create the composite index with the fields above
    
    console.log('Index configuration:');
    console.log(JSON.stringify(indexData, null, 2));
    console.log('\nPlease create this index manually in the Firebase Console:');
    console.log('https://console.firebase.google.com/v1/r/project/homebase-dapp/firestore/indexes');
    console.log('\nOr use the direct link from the error message in your terminal.');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

createIndexes().then(() => {
  console.log('Index creation script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
