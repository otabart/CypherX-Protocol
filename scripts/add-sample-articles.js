const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase config (you'll need to add your actual config)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sampleArticles = [
  {
    title: "Base Chain Sees Record Growth in DeFi Activity",
    content: "The Base Chain ecosystem has experienced unprecedented growth in decentralized finance activity, with total value locked (TVL) reaching new heights. This surge in activity is driven by innovative DeFi protocols and increased developer adoption.",
    author: "CypherX Team",
    source: "CypherX Analytics"
  },
  {
    title: "New Token Launch Platform Revolutionizes Base Chain",
    content: "A groundbreaking new token launch platform has emerged on Base Chain, offering creators and developers unprecedented tools for launching and managing their tokens. This platform is expected to accelerate the growth of the Base ecosystem.",
    author: "CypherX Team", 
    source: "CypherX Analytics"
  },
  {
    title: "Memecoin Season Heats Up on Base Chain",
    content: "The memecoin season is in full swing on Base Chain, with several new tokens gaining significant traction. Our analytics show increased trading volume and community engagement across multiple meme tokens.",
    author: "CypherX Team",
    source: "CypherX Analytics"
  },
  {
    title: "DeFi Innovation Continues on Base Chain",
    content: "Base Chain continues to be a hotbed for DeFi innovation, with new protocols launching regularly. The combination of low fees and high throughput makes Base an attractive platform for developers and users alike.",
    author: "CypherX Team",
    source: "CypherX Analytics"
  },
  {
    title: "Community-Driven Projects Thrive on Base",
    content: "Community-driven projects are finding great success on Base Chain, with many achieving significant milestones. The supportive ecosystem and active community contribute to the success of these initiatives.",
    author: "CypherX Team",
    source: "CypherX Analytics"
  }
];

async function addSampleArticles() {
  try {
    console.log('Adding sample articles to Firebase...');
    
    for (const article of sampleArticles) {
      const docRef = await addDoc(collection(db, 'articles'), {
        ...article,
        publishedAt: serverTimestamp(),
        slug: article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      });
      console.log(`Added article: ${article.title} (ID: ${docRef.id})`);
    }
    
    console.log('✅ Sample articles added successfully!');
  } catch (error) {
    console.error('❌ Error adding sample articles:', error);
  }
}

addSampleArticles(); 