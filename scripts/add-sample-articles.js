const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  // Add your Firebase config here
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

const sampleArticles = [
  {
    title: "Base Chain Surpasses $1B in Total Value Locked",
    content: "Base Chain, Coinbase's Layer 2 solution, has achieved a significant milestone by surpassing $1 billion in Total Value Locked (TVL). This achievement demonstrates the growing adoption and trust in the Base ecosystem, which has been gaining momentum since its launch. The platform has seen increased developer activity and user engagement, with numerous DeFi protocols and applications being built on top of it.",
    author: "Crypto Analyst",
    source: "Base News",
    category: "DeFi",
    excerpt: "Base Chain reaches $1B TVL milestone, marking a significant achievement for the Coinbase-backed Layer 2 solution.",
    views: 1250,
    upvotes: 89,
    downvotes: 12,
    comments: [
      "This is huge for Base!",
      "Great to see the ecosystem growing",
      "What's next for Base?"
    ]
  },
  {
    title: "New DeFi Protocol Launches on Base with Innovative Yield Farming",
    content: "A new decentralized finance protocol has launched on Base Chain, introducing innovative yield farming mechanisms that reward users for providing liquidity. The protocol features a unique tokenomics model and has already attracted significant attention from the DeFi community. Early users are reporting impressive APY rates, though experts caution about the risks associated with new protocols.",
    author: "DeFi Reporter",
    source: "Base Insights",
    category: "DeFi",
    excerpt: "Innovative yield farming protocol launches on Base with unique tokenomics and high APY opportunities.",
    views: 890,
    upvotes: 67,
    downvotes: 8,
    comments: [
      "APY looks promising!",
      "Need to DYOR before investing",
      "Great addition to the Base ecosystem"
    ]
  },
  {
    title: "Base Chain Developer Tools Get Major Update",
    content: "The Base Chain development team has released a major update to their developer tools, making it easier for developers to build and deploy applications on the platform. The update includes improved documentation, new SDK features, and enhanced debugging capabilities. This update is expected to accelerate the development of new applications on Base Chain.",
    author: "Tech Writer",
    source: "Base Dev",
    category: "Development",
    excerpt: "Major developer tools update released for Base Chain, improving the development experience for builders.",
    views: 567,
    upvotes: 45,
    downvotes: 3,
    comments: [
      "Finally better docs!",
      "This will help new developers",
      "Great work by the team"
    ]
  },
  {
    title: "Base Chain Partners with Major Gaming Studio",
    content: "Base Chain has announced a strategic partnership with a major gaming studio to bring blockchain gaming to the platform. The partnership will focus on creating games that leverage Base's low transaction costs and fast finality. This move signals Base's expansion into the gaming sector, which has been growing rapidly in the blockchain space.",
    author: "Gaming Editor",
    source: "Base Gaming",
    category: "Gaming",
    excerpt: "Strategic partnership announced between Base Chain and major gaming studio for blockchain gaming development.",
    views: 1200,
    upvotes: 92,
    downvotes: 15,
    comments: [
      "Gaming on Base? Count me in!",
      "This could be huge for adoption",
      "Wonder what games they'll build"
    ]
  },
  {
    title: "Base Chain Security Audit Results Released",
    content: "The results of a comprehensive security audit of Base Chain have been released, showing strong security measures and identifying only minor issues that have been addressed. The audit was conducted by a leading blockchain security firm and covered the core protocol, smart contracts, and infrastructure. This transparency builds confidence in the platform's security.",
    author: "Security Analyst",
    source: "Base Security",
    category: "Security",
    excerpt: "Comprehensive security audit results show Base Chain maintains strong security standards with minor issues addressed.",
    views: 750,
    upvotes: 78,
    downvotes: 5,
    comments: [
      "Good to see transparency",
      "Security is crucial for adoption",
      "Well done on the audit"
    ]
  }
];

async function addSampleArticles() {
  try {
    console.log('Adding sample articles...');
    
    for (const article of sampleArticles) {
      const docRef = await addDoc(collection(db, 'articles'), {
        ...article,
        publishedAt: serverTimestamp(),
        slug: article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        updatedAt: serverTimestamp()
      });
      
      console.log(`Added article: ${article.title} (ID: ${docRef.id})`);
    }
    
    console.log('All sample articles added successfully!');
  } catch (error) {
    console.error('Error adding sample articles:', error);
  }
}

// Run the script
addSampleArticles(); 