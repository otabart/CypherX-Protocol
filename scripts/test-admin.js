import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./firebaseServiceAccount.json', 'utf8'));
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function testAdminSetup() {
  try {
    // Replace with your actual admin wallet address
    const adminWalletAddress = '0x4146E18FeF6883Ee7c2F16feC60109133F1Fc491';
    
    if (adminWalletAddress === 'YOUR_ADMIN_WALLET_ADDRESS_HERE') {
      console.log('⚠️  Please update the adminWalletAddress in scripts/setup-admin.js');
      console.log('📝 Then run: node scripts/setup-admin.js');
      return;
    }

    // Check if admin exists
    const adminQuery = db.collection('users').where('walletAddress', '==', adminWalletAddress);
    const adminSnapshot = await adminQuery.get();

    if (!adminSnapshot.empty) {
      const adminData = adminSnapshot.docs[0].data();
      console.log('✅ Admin account found!');
      console.log('📊 Admin Stats:');
      console.log(`   Points: ${adminData.points?.toLocaleString() || 0}`);
      console.log(`   Tier: ${adminData.tier || 'bronze'}`);
      console.log(`   Badges: ${adminData.badges?.length || 0}`);
      console.log(`   Volume: $${adminData.totalVolumeUSD?.toLocaleString() || 0}`);
      console.log(`   Referral Code: ${adminData.referralCode || 'N/A'}`);
      console.log(`   Referral Count: ${adminData.referralCount || 0}`);
      console.log(`   Referral Earnings: ${adminData.referralEarnings?.toLocaleString() || 0}`);
    } else {
      console.log('❌ Admin account not found');
      console.log('📝 Run: node scripts/setup-admin.js');
    }

  } catch (error) {
    console.error('❌ Error testing admin setup:', error);
  }
}

testAdminSetup(); 