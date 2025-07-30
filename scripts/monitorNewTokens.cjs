const { ethers } = require("ethers");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// Replace with your Base RPC URL
const provider = new ethers.JsonRpcProvider("https://base.llamarpc.com");

const FACTORIES = [
  {
    name: "Aerodrome",
    address: "0x420dd381b31aef6683fa7e9d3c33269d4e2b66bf"
  },
  {
    name: "BaseSwap",
    address: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86"
  },
  {
    name: "UniswapV2",
    address: "0xCf083Be4164828f00cAE704EC15a36D711491284"
  },
  // Add more as needed
];

const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

const PAIR_CREATED_TOPIC = ethers.id("PairCreated(address,address,address,uint256)");
const POLL_INTERVAL = 15000; // 15 seconds
const MAX_BLOCK_RANGE = 1000;

async function pollFactory(factory) {
  const contract = new ethers.Contract(factory.address, FACTORY_ABI, provider);
  let lastBlock = (await provider.getBlockNumber()) - 1000;
  console.log(`[${factory.name}] Starting poller at block ${lastBlock}`);

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock > lastBlock) {
        let from = lastBlock + 1;
        let to = Math.min(from + MAX_BLOCK_RANGE - 1, currentBlock);
        while (from <= currentBlock) {
          const logs = await provider.getLogs({
            address: factory.address,
            fromBlock: from,
            toBlock: to,
            topics: [PAIR_CREATED_TOPIC]
          });
          if (logs.length > 0) {
            for (const log of logs) {
              const parsed = contract.interface.parseLog(log);
              const token0 = parsed.args.token0;
              const token1 = parsed.args.token1;
              const now = admin.firestore.Timestamp.now();
              await db.collection("Cypherscope").doc(token0).set({ address: token0, createdAt: now }, { merge: true });
              await db.collection("Cypherscope").doc(token1).set({ address: token1, createdAt: now }, { merge: true });
              console.log(`[${factory.name}] Added tokens:`, token0, token1, "at", now.toDate());
            }
          }
          from = to + 1;
          to = Math.min(from + MAX_BLOCK_RANGE - 1, currentBlock);
        }
        lastBlock = currentBlock;
      }
    } catch (err) {
      console.error(`[${factory.name}] Polling error:`, err);
    }
  }, POLL_INTERVAL);
}

(async () => {
  // Start DEX factory monitoring
  for (const factory of FACTORIES) {
    pollFactory(factory);
    console.log(`Polling for new pairs on ${factory.name}...`);
  }
  
  console.log("Monitoring script started. Press Ctrl+C to stop.");
})(); 