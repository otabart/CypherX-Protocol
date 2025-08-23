const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixWalletAddressSync() {
  try {
    console.log('🔍 Starting wallet address sync fix...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users in database`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if user has a wallet address that looks like a placeholder
      if (userData.walletAddress && userData.walletAddress.startsWith('user_')) {
        console.log(`⚠️  User ${userId} has placeholder wallet address: ${userData.walletAddress}`);
        
        // Check if user has an email (indicating they're authenticated)
        if (userData.email) {
          console.log(`📧 User has email: ${userData.email}`);
          
          // For now, we'll just log these cases
          // In a real scenario, you might want to prompt the user to create a wallet
          // or automatically create one for them
          skippedCount++;
        } else {
          console.log(`❌ User ${userId} has no email, skipping...`);
          skippedCount++;
        }
      } else if (userData.walletAddress && userData.walletAddress.startsWith('0x')) {
        console.log(`✅ User ${userId} has valid wallet address: ${userData.walletAddress}`);
        fixedCount++;
      } else {
        console.log(`❓ User ${userId} has unknown wallet address format: ${userData.walletAddress}`);
        skippedCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Users with valid wallet addresses: ${fixedCount}`);
    console.log(`⚠️  Users with placeholder addresses: ${skippedCount}`);
    console.log(`📝 Total users processed: ${usersSnapshot.size}`);
    
    console.log('\n💡 Recommendations:');
    console.log('1. Users with placeholder addresses need to create a wallet');
    console.log('2. The new wallet sync feature will prevent this issue for new users');
    console.log('3. Consider prompting existing users to create wallets');
    
  } catch (error) {
    console.error('❌ Error fixing wallet address sync:', error);
  }
}

// Run the fix
fixWalletAddressSync().then(() => {
  console.log('✅ Wallet address sync fix completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
