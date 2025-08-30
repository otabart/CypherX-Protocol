import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./firebaseServiceAccount.json', 'utf8'));

if (!serviceAccount) {
  console.error('❌ Firebase service account not found. Please ensure firebaseServiceAccount.json exists.');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function setupWalletIndexes() {
  console.log('🔧 Setting up Firebase indexes for wallet transactions...');
  
  try {
    // 🔧 NEW: Create composite indexes for wallet_transactions collection
    
    // Index 1: For orders API - walletAddress + type + outputToken + timestamp
    console.log('📊 Creating index: walletAddress + type + outputToken + timestamp');
    await db.collection('wallet_transactions').createIndex({
      fields: [
        { fieldPath: 'walletAddress', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'outputToken', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ]
    });
    
    // Index 2: For sell orders - walletAddress + type + inputToken + timestamp
    console.log('📊 Creating index: walletAddress + type + inputToken + timestamp');
    await db.collection('wallet_transactions').createIndex({
      fields: [
        { fieldPath: 'walletAddress', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'inputToken', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ]
    });
    
    // Index 3: For positions API - walletAddress + type + timestamp
    console.log('📊 Creating index: walletAddress + type + timestamp');
    await db.collection('wallet_transactions').createIndex({
      fields: [
        { fieldPath: 'walletAddress', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ]
    });
    
    // Index 4: For PnL API - walletAddress + type + outputToken + timestamp
    console.log('📊 Creating index: walletAddress + type + outputToken + timestamp (PnL)');
    await db.collection('wallet_transactions').createIndex({
      fields: [
        { fieldPath: 'walletAddress', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'outputToken', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ]
    });
    
    console.log('✅ All indexes created successfully!');
    console.log('');
    console.log('📋 Index Summary:');
    console.log('  1. Orders API: walletAddress + type + outputToken + timestamp');
    console.log('  2. Sell Orders: walletAddress + type + inputToken + timestamp');
    console.log('  3. Positions API: walletAddress + type + timestamp');
    console.log('  4. PnL API: walletAddress + type + outputToken + timestamp');
    console.log('');
    console.log('🔄 Note: Indexes may take a few minutes to build. Check Firebase Console for status.');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    
    if (error.code === 'ALREADY_EXISTS') {
      console.log('ℹ️  Some indexes already exist. This is normal.');
    } else {
      console.log('💡 Make sure you have the necessary permissions to create indexes.');
      console.log('💡 You may need to create these indexes manually in the Firebase Console.');
    }
  }
}

async function testQueries() {
  console.log('🧪 Testing queries...');
  
  try {
    // Test 1: Get all swap transactions for a wallet
    console.log('📊 Test 1: All swap transactions');
    const allSwaps = await db.collection('wallet_transactions')
      .where('walletAddress', '==', '0x3185aDE0997fFEC4fdba121809Fca05018B1e274')
      .where('type', '==', 'swap')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    console.log(`   Found ${allSwaps.size} transactions`);
    
    // Test 2: Get buy orders for a specific token
    console.log('📊 Test 2: Buy orders for specific token');
    const buyOrders = await db.collection('wallet_transactions')
      .where('walletAddress', '==', '0x3185aDE0997fFEC4fdba121809Fca05018B1e274')
      .where('type', '==', 'swap')
      .where('inputToken', '==', 'ETH')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    console.log(`   Found ${buyOrders.size} buy orders`);
    
    // Test 3: Get sell orders for a specific token
    console.log('📊 Test 3: Sell orders for specific token');
    const sellOrders = await db.collection('wallet_transactions')
      .where('walletAddress', '==', '0x3185aDE0997fFEC4fdba121809Fca05018B1e274')
      .where('type', '==', 'swap')
      .where('inputToken', '!=', 'ETH')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    console.log(`   Found ${sellOrders.size} sell orders`);
    
    console.log('✅ Query tests completed!');
    
  } catch (error) {
    console.error('❌ Error testing queries:', error);
    console.log('💡 This might be due to missing indexes. Check Firebase Console.');
  }
}

// Run the setup
async function main() {
  console.log('🚀 Wallet Transaction Index Setup');
  console.log('=====================================');
  
  await setupWalletIndexes();
  console.log('');
  await testQueries();
  
  console.log('');
  console.log('🎉 Setup complete!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('  1. Check Firebase Console > Firestore > Indexes');
  console.log('  2. Wait for indexes to finish building (may take 5-10 minutes)');
  console.log('  3. Test the Orders and Positions APIs');
  console.log('  4. Sell orders should now appear in the Orders tab');
  
  process.exit(0);
}

main().catch(console.error);
