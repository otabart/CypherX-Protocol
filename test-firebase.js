import admin from 'firebase-admin';

console.log('🔍 Testing Firebase Admin connection...');

// Check environment variables
console.log('Environment variables:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'SET (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'NOT SET');

try {
  // Try to initialize with environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const normalizePrivateKey = (key) => {
      return key
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\s+/g, "")
        .trim();
    };

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    };

    console.log('Service account config:', {
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKeyLength: serviceAccount.privateKey.length
    });

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase Admin initialized successfully');
    
    // Test a simple read operation
    console.log('🔍 Testing database connection...');
    const testDoc = await db.collection('test').doc('connection-test').get();
    console.log('✅ Database connection successful');
    
  } else {
    console.log('❌ Environment variables not complete');
  }
} catch (error) {
  console.error('❌ Firebase connection failed:', error.message);
  console.error('Error details:', error);
}
