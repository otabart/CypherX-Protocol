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
    
    // Index 1: Articles collection composite index (this is the one causing the error)
    const articlesIndexData = {
      collectionGroup: 'articles',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'category',
          order: 'ASCENDING'
        },
        {
          fieldPath: 'publishedAt',
          order: 'ASCENDING'
        },
        {
          fieldPath: '__name__',
          order: 'ASCENDING'
        }
      ]
    };

    // Index 2: User activities composite index
    const userActivitiesIndexData = {
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

    // Index 3: Comments collection index
    const commentsIndexData = {
      collectionGroup: 'comments',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'articleSlug',
          order: 'ASCENDING'
        },
        {
          fieldPath: 'createdAt',
          order: 'DESCENDING'
        }
      ]
    };

    console.log('Required Firebase indexes:');
    console.log('\n1. Articles Index (REQUIRED - this is causing the error):');
    console.log(JSON.stringify(articlesIndexData, null, 2));
    console.log('\nDirect link to create this index:');
    console.log('https://console.firebase.google.com/v1/r/project/homebase-dapp/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9ob21lYmFzZS1kYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hcnRpY2xlcy9pbmRleGVzL18QARoMCghjYXRlZ29yeRABGg8KC3B1Ymxpc2hlZEF0EAIaDAoIX19uYW1lX18QAg');
    
    console.log('\n2. User Activities Index:');
    console.log(JSON.stringify(userActivitiesIndexData, null, 2));
    
    console.log('\n3. Comments Index:');
    console.log(JSON.stringify(commentsIndexData, null, 2));
    
    console.log('\nPlease create these indexes manually in the Firebase Console:');
    console.log('https://console.firebase.google.com/v1/r/project/homebase-dapp/firestore/indexes');
    console.log('\nOr use the direct link above for the articles index.');
    
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
