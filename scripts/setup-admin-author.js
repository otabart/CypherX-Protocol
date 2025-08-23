import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

// Initialize Firebase Admin using the same method as the app
const initializeAdmin = () => {
  try {
    console.log("Starting Firebase Admin initialization...");
    
    // Try service account from JSON file
    const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
    
    if (existsSync(serviceAccountPath)) {
      const serviceAccountFile = readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountFile);
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      }
      
      console.log("Successfully initialized with service account from JSON file");
      return admin.firestore();
    } else {
      throw new Error("Service account JSON file not found");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    throw error;
  }
};

const db = initializeAdmin();

async function setupAdminAuthor() {
  try {
    console.log('Setting up admin account as author...');
    
    // First, find the admin user by email
    const adminEmail = 'homebasemarkets@gmail.com';
    
    // Search for user with this email
    const usersQuery = await db.collection('users').where('email', '==', adminEmail).get();
    
    if (usersQuery.empty) {
      console.log('Admin user not found. Creating new admin user...');
      
      // Create new admin user
      const adminUserRef = await db.collection('users').add({
        email: adminEmail,
        walletAddress: 'admin_wallet_address', // You can update this with actual wallet
        isAuthor: true,
        authorStatus: 'approved',
        twitterHandle: 'homebasemarkets',
        bio: 'Admin account for Homebase Markets',
        topics: ['cryptocurrency', 'trading', 'defi', 'market analysis'],
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Admin user created with ID: ${adminUserRef.id}`);
    } else {
      console.log('Admin user found. Updating to author status...');
      
      // Update existing user to be an author
      const adminUserDoc = usersQuery.docs[0];
      await adminUserDoc.ref.update({
        isAuthor: true,
        authorStatus: 'approved',
        twitterHandle: 'homebasemarkets',
        bio: 'Admin account for Homebase Markets',
        topics: ['cryptocurrency', 'trading', 'defi', 'market analysis'],
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Admin user updated: ${adminUserDoc.id}`);
    }
    
    // Create authors collection entry
    const authorsQuery = await db.collection('authors').where('email', '==', adminEmail).get();
    
    if (authorsQuery.empty) {
      await db.collection('authors').add({
        email: adminEmail,
        walletAddress: 'admin_wallet_address',
        twitterHandle: 'homebasemarkets',
        bio: 'Admin account for Homebase Markets',
        topics: ['cryptocurrency', 'trading', 'defi', 'market analysis'],
        status: 'approved',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalPosts: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalEarnings: 0
      });
      
      console.log('Author record created in authors collection');
    } else {
      console.log('Author record already exists');
    }
    
    console.log('Admin author setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up admin author:', error);
  } finally {
    process.exit(0);
  }
}

setupAdminAuthor();
