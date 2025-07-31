const { getCoins, getCoin, setApiKey } = require("@zoralabs/coins-sdk");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// Database file for fallback
const DB_FILE = path.join(__dirname, "../data/zora-tokens.json");

// Ensure data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Save tokens to local JSON file as fallback
function saveTokensToLocal(tokens) {
  try {
    const data = {
      tokens: tokens,
      lastUpdate: Date.now(),
      source: "zora"
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${tokens.length} tokens to local file`);
  } catch (error) {
    console.error("❌ Local save error:", error.message);
  }
}

// Set up Zora API key
const ZORA_API_KEY = process.env.ZORA_API_KEY || "zora_api_a9628962c935e17de3c0c5176553e1c643c89b51b23ead436684f45e4e8c45ed";
console.log("🔑 Using API key:", ZORA_API_KEY.substring(0, 15) + "...");
setApiKey(ZORA_API_KEY);
console.log("✅ Zora API key configured");

// Test with a known token first
async function testSingleToken() {
  try {
    console.log("🧪 Testing single token fetch...");
    const response = await getCoin({
      address: "0x445e9c0a296068dc4257767b5ed354b77cf513de", // Known Zora token
      chain: 8453
    });
    console.log("✅ Single token test successful!");
    console.log("Token name:", response.data?.zora20Token?.name);
    return true;
  } catch (error) {
    console.log("❌ Single token test failed:", error.message);
    return false;
  }
}

// Fetch Zora tokens
async function fetchZoraTokens() {
  console.log("🔍 Fetching Zora tokens...");
  
  // Test single token first
  const singleTokenWorks = await testSingleToken();
  if (!singleTokenWorks) {
    console.log("❌ Single token test failed, skipping batch fetch");
    return [];
  }
  
  try {
    // Try to get multiple coins - expanded list of known Zora tokens
    const knownAddresses = [
      "0x445e9c0a296068dc4257767b5ed354b77cf513de", // up
      "0x9ac1a5840869bd73ce0a84f568c8f2b2d9ddb177", // faketaxi
      "0x9427e66d26e4ac8d839d21ab901d96a8221f3e94", // Coinbase2025Q2EarningsQA
      "0x1f6e1d08368fd4d8b2250ab0600dd2cb7f643287", // TBD
      "0x208EAF389B055eA165DD3f547423aB24ad2AdB07", // Your token
      "0x3a5df03dd1a001d7055284c2c2c147cbbc78d142", // Creator of 'up'
      "0x8c19b2a3fc558f2e4b9c62214f810e95d406f45b", // Creator of 'faketaxi'
      "0x2b886875d17c51b3cde74623d06e315f2994fa64", // Creator of 'Coinbase2025Q2EarningsQA'
      "0x61297bce35557ebca1479d6d6162f12ba336bd67", // Creator of 'TBD'
      "0x1eaf444ebDf6495C57aD52A04C61521bBf564ace", // Interface admin
      "0x4200000000000000000000000000000000000006", // WETH on Base
      "0x4200000000000000000000000000000000000007", // USDC on Base
    ];

    const response = await getCoins({
      coins: knownAddresses.map(address => ({
        collectionAddress: address,
        chainId: 8453
      })),
      chainId: 8453 // Base chain
    });
    
    console.log("📊 Response received:", response ? "yes" : "no");
    if (response) {
      console.log("📊 Response structure:", Object.keys(response));
      if (response.data) {
        console.log("📊 Data structure:", Object.keys(response.data));
      }
      if (response.error) {
        console.log("❌ Error:", response.error);
      }
    }
    
    // Try different response structures
    const zoraTokens = response?.data?.zora20Tokens || 
                       response?.zora20Tokens || 
                       response?.data?.coins || 
                       [];
    console.log(`✅ Found ${zoraTokens.length} Zora tokens`);
    
    if (!Array.isArray(zoraTokens)) {
      console.log("❌ No tokens found in response");
      return [];
    }
    
               return zoraTokens
             .filter(token => token && token.address) // Filter out null/undefined tokens
             .map(token => ({
               address: token.address,
               name: token.name || "Unknown",
               symbol: token.symbol || "UNKNOWN",
               marketCap: token.marketCap || "0",
               volume24h: token.volume24h || "0",
               uniqueHolders: token.uniqueHolders || 0,
               totalSupply: token.totalSupply || "0",
               creatorAddress: token.creatorAddress || "",
               createdAt: token.createdAt || new Date().toISOString(),
               mediaContent: token.mediaContent || null,
               source: "zora",
               dexName: "Zora",
               pairAddress: null,
               description: token.description || "",
               website: token.website || "",
               telegram: token.telegram || "",
               twitter: token.twitter || "",
               totalVolume: token.totalVolume || "0",
               marketCapDelta24h: token.marketCapDelta24h || "0",
               tokenUri: token.tokenUri || ""
             }));
  } catch (error) {
    console.error("❌ Zora fetch error:", error.message);
    console.error("❌ Full error:", error);
    return [];
  }
}

// Save tokens to Firebase
async function saveTokensToFirebase(tokens) {
  try {
    console.log("💾 Saving tokens to Firebase...");
    const batch = db.batch();
    
    for (const token of tokens) {
      const docRef = db.collection("Cypherscope").doc(token.address);
      batch.set(docRef, {
        ...token,
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });
    }
    
    await batch.commit();
    console.log(`✅ Saved ${tokens.length} tokens to Firebase`);
  } catch (error) {
    console.error("❌ Firebase save error:", error.message);
    saveTokensToLocal(tokens); // Fallback to local file
  }
}

// Main function
async function main() {
  console.log("🚀 Starting Zora Token Fetcher...");
  
  // Fetch tokens from Zora
  const tokens = await fetchZoraTokens();
  
  if (tokens.length > 0) {
    // Save to Firebase
    await saveTokensToFirebase(tokens);
    
    // Show some examples
    console.log("\n📊 Sample tokens:");
    tokens.slice(0, 5).forEach(token => {
      console.log(`   ${token.name} (${token.symbol})`);
      console.log(`   Market Cap: $${parseFloat(token.marketCap || "0").toLocaleString()}`);
      console.log(`   24h Volume: $${parseFloat(token.volume24h || "0").toLocaleString()}`);
      console.log(`   Holders: ${token.uniqueHolders || "0"}`);
      console.log("   ---");
    });
  }
  
  console.log("\n✅ Zora fetching complete!");
  console.log("💾 Firebase updated at:", new Date().toLocaleString());
}

// Run the fetcher
main().catch(console.error); 