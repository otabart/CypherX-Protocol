const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixDownvotes() {
  try {
    console.log('🔧 Fixing negative downvote values...');
    
    // Get all articles
    const articlesRef = collection(db, 'articles');
    const querySnapshot = await getDocs(articlesRef);
    
    let fixedCount = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const downvotes = data.downvotes || 0;
      
      if (downvotes < 0) {
        console.log(`📝 Article "${data.title}" has negative downvotes: ${downvotes}`);
        console.log(`   Setting downvotes to 0...`);
        
        // Update the document
        updateDoc(doc(db, 'articles', doc.id), {
          downvotes: 0
        });
        
        fixedCount++;
      }
    });
    
    if (fixedCount > 0) {
      console.log(`✅ Fixed ${fixedCount} articles with negative downvotes`);
    } else {
      console.log('✅ No articles with negative downvotes found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing downvotes:', error);
  }
}

// Run the script
fixDownvotes(); 