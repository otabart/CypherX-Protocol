import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const initializeFirebase = () => {
  try {
    console.log('🚀 Initializing Firebase Admin...');
    
    // Try to read service account file
    const serviceAccountPath = path.join(__dirname, '..', 'firebaseServiceAccount.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at: ${serviceAccountPath}`);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'homebase-dapp'
      });
    }
    
    console.log('✅ Firebase Admin initialized successfully');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
};

// Create collections and documents
const setupCollections = async (db) => {
  console.log('📦 Setting up Firebase collections...');
  
  try {
    // Create users collection with a sample user
    const usersRef = db.collection('users');
    await usersRef.doc('sample-user').set({
      points: 100,
      totalEarned: 100,
      totalSpent: 0,
      tier: 'normie',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      dailyActions: {},
      contributions: 0,
      articles: 0,
      followers: 0
    });
    console.log('✅ Created sample user');

    // Create pointTransactions collection
    const transactionsRef = db.collection('pointTransactions');
    await transactionsRef.doc('sample-transaction').set({
      userId: 'sample-user',
      walletAddress: '0x1234567890123456789012345678901234567890',
      action: 'daily_login',
      points: 5,
      description: 'Daily login bonus',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {}
    });
    console.log('✅ Created sample transaction');

    // Create user_activities collection
    const activitiesRef = db.collection('user_activities');
    await activitiesRef.doc('sample-activity').set({
      userId: 'sample-user',
      walletAddress: '0x1234567890123456789012345678901234567890',
      action: 'daily_login',
      points: 5,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {}
    });
    console.log('✅ Created sample activity');

    // Create alphaBoosts collection
    const alphaBoostsRef = db.collection('alphaBoosts');
    await alphaBoostsRef.doc('sample-boost').set({
      userId: 'sample-user',
      articleId: 'sample-article',
      cost: 25,
      multiplier: 1.5,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Created sample alpha boost');

    console.log('🎉 All collections and sample data created successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up collections:', error);
    throw error;
  }
};

// Main setup function
const main = async () => {
  try {
    console.log('🔧 Starting Point Economy Setup...\n');
    
    const db = initializeFirebase();
    await setupCollections(db);
    
    console.log('\n✅ Point Economy setup completed successfully!');
    console.log('\n📋 What was created:');
    console.log('   • users collection with sample user');
    console.log('   • pointTransactions collection with sample transaction');
    console.log('   • user_activities collection with sample activity');
    console.log('   • alphaBoosts collection with sample boost');
    console.log('\n🚀 Your point economy system is ready to use!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
};

// Run the setup
main();
