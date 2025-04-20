// demo-script.js
const { Alchemy, Network } = require("alchemy-sdk");

// Initialize Alchemy SDK
const settings = {
  apiKey: "YOUR_ALCHEMY_API_KEY", // Replace with your Alchemy API key
  network: Network.ETH_MAINNET, // Use ETH_MAINNET for Ethereum mainnet
};
const alchemy = new Alchemy(settings);

// Threshold for "whale" transfers (e.g., 100 ETH in wei)
const WHALE_THRESHOLD = BigInt("100000000000000000000"); // 100 ETH in wei (1 ETH = 10^18 wei)

// Function to fetch and filter large transactions
async function trackWhaleTransfers() {
  try {
    // Get the latest block
    const latestBlock = await alchemy.core.getBlockNumber();
    console.log(`Latest block: ${latestBlock}`);

    // Get transactions in the latest block
    const block = await alchemy.core.getBlockWithTransactions(latestBlock);

    // Filter transactions for large ETH transfers
    block.transactions.forEach((tx) => {
      if (tx.value && tx.value > WHALE_THRESHOLD) {
        console.log("🐳 Whale Transfer Detected:");
        console.log(`- Hash: ${tx.hash}`);
        console.log(`- From: ${tx.from}`);
        console.log(`- To: ${tx.to}`);
        console.log(`- Value: ${(Number(tx.value) / 1e18).toFixed(2)} ETH`);
      }
    });
  } catch (error) {
    console.error("Error tracking whale transfers:", error);
  }
}

// Run the tracking function every 30 seconds
setInterval(trackWhaleTransfers, 30000);

// Run immediately on start
trackWhaleTransfers();