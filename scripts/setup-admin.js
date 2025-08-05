import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin using environment variables (like the main app)
const normalizePrivateKey = (key) => {
  if (!key) {
    throw new Error("FIREBASE_PRIVATE_KEY is undefined or empty");
  }
  let normalizedKey = key
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\n+/g, "\n")
    .trim();
  if (!normalizedKey.startsWith("-----BEGIN PRIVATE KEY-----\n")) {
    normalizedKey = "-----BEGIN PRIVATE KEY-----\n" + normalizedKey;
  }
  if (!normalizedKey.endsWith("\n-----END PRIVATE KEY-----\n")) {
    normalizedKey = normalizedKey + "\n-----END PRIVATE KEY-----\n";
  }
  return normalizedKey;
};

// Try to get credentials from environment variables first
let app;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  console.log("Using environment variables for Firebase authentication");
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    })
  });
} else {
  // Fallback to service account JSON file
  console.log("Using service account JSON file for Firebase authentication");
  const serviceAccount = JSON.parse(readFileSync('./firebaseServiceAccount.json', 'utf8'));
  app = initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore(app);

async function setupAdminAccount() {
  try {
    // Replace with your admin wallet address
    const adminWalletAddress = '0x4146E18FeF6883Ee7c2F16feC60109133F1Fc491';
    
    if (adminWalletAddress === 'YOUR_ADMIN_WALLET_ADDRESS_HERE') {
      console.error('Please update the adminWalletAddress in the script');
      return;
    }

    const adminData = {
      walletAddress: adminWalletAddress,
      points: 50000, // Max points
      tier: 'diamond',
      badges: [
        'first_swap',
        'volume_trader', 
        'whale_trader',
        'daily_user',
        'weekly_user',
        'power_user',
        'content_creator',
        'popular_author',
        'viral_author',
        'event_organizer',
        'community_leader',
        'influencer',
        'early_adopter',
        'beta_tester',
        'bug_hunter'
      ],
      totalVolumeUSD: 1000000, // $1M volume
      swapCount: 1000,
      authorPoints: 5000,
      referralCode: 'ADMIN',
      referralCount: 100,
      referralEarnings: 50000,
      isAdmin: true,
      createdAt: FieldValue.serverTimestamp(),
      lastActivity: FieldValue.serverTimestamp(),
    };

    // Check if admin already exists
    const adminQuery = db.collection('users').where('walletAddress', '==', adminWalletAddress);
    const adminSnapshot = await adminQuery.get();

    if (!adminSnapshot.empty) {
      // Update existing admin
      const adminDoc = adminSnapshot.docs[0];
      await db.collection('users').doc(adminDoc.id).update(adminData);
      console.log('✅ Admin account updated successfully');
    } else {
      // Create new admin
      await db.collection('users').add(adminData);
      console.log('✅ Admin account created successfully');
    }

    // Update leaderboard
    const leaderboardQuery = db.collection('leaderboard').where('walletAddress', '==', adminWalletAddress);
    const leaderboardSnapshot = await leaderboardQuery.get();

    if (!leaderboardSnapshot.empty) {
      await db.collection('leaderboard').doc(leaderboardSnapshot.docs[0].id).update({
        points: 50000,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection('leaderboard').add({
        walletAddress: adminWalletAddress,
        points: 50000,
        createdAt: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
      });
    }

    console.log('✅ Admin setup complete!');
    console.log('📊 Admin Stats:');
    console.log(`   Points: ${adminData.points.toLocaleString()}`);
    console.log(`   Tier: ${adminData.tier}`);
    console.log(`   Badges: ${adminData.badges.length}`);
    console.log(`   Volume: $${adminData.totalVolumeUSD.toLocaleString()}`);
    console.log(`   Referral Code: ${adminData.referralCode}`);

  } catch (error) {
    console.error('❌ Error setting up admin:', error);
  }
}

// Export the function for use in other scripts
export default setupAdminAccount;

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAdminAccount();
} 