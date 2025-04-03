// aggregator.ts
import { ethers } from "ethers";
import tokenMapping from "./app/tokenMapping.json" assert { type: "json" };

const MIN_PERCENT_SUPPLY = 0.001; // lowered for testing
const MIN_TOKEN_AMOUNT = 1;       // lowered for testing

async function main() {
  console.log("🐋 Whale Watcher (ethers.js) starting...");

  // Connect to Base via a WebSocket provider.
  // Replace with a reliable provider URL for Base if needed.
  const providerUrl = "wss://mainnet.base.org";
  const provider = new ethers.WebSocketProvider(providerUrl);

  const tokenData: Record<string, { totalSupply: number; decimals: number }> = {};

  const erc20Abi = [
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];

  for (const [symbol, address] of Object.entries(tokenMapping)) {
    try {
      const contract = new ethers.Contract(address, erc20Abi, provider);
      const [supplyBN, decimalsBN] = await Promise.all([
        contract.totalSupply(),
        contract.decimals()
      ]);
      const decimals = Number(decimalsBN);
      const totalSupply = parseFloat(ethers.utils.formatUnits(supplyBN, decimals));
      tokenData[address.toLowerCase()] = { totalSupply, decimals };

      // Listen for Transfer events and log every event for debugging.
      contract.on("Transfer", async (from, to, valueBN) => {
        try {
          const tokenAmount = parseFloat(ethers.utils.formatUnits(valueBN, decimals));
          console.log(`Transfer event for ${symbol}: from ${from} to ${to}, amount: ${tokenAmount}`);
          const pctOfSupply = (tokenAmount / totalSupply) * 100;

          if (tokenAmount >= MIN_TOKEN_AMOUNT || pctOfSupply >= MIN_PERCENT_SUPPLY) {
            const payload = {
              tokenSymbol: symbol,
              tokenName: symbol,
              tokenAddress: address,
              amountToken: tokenAmount,
              percentSupply: pctOfSupply,
              fromAddress: from,
              toAddress: to,
              source: "ethers.js",
              timestamp: Date.now()
            };

            const resp = await fetch("http://localhost:3000/whale-watcher/api", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            console.log(`✅ Posted whale tx for ${symbol}:`, await resp.json());
          }
        } catch (err) {
          console.error(`❌ Transfer handler error for ${symbol}:`, err);
        }
      });

      console.log(`🔗 Listening for transfers of ${symbol} at ${address}`);
    } catch (err) {
      console.error(`❌ Error setting up ${symbol} (${address}):`, err);
    }
  }

  console.log("🚀 Aggregator is now listening for Transfer events. Press Ctrl+C to stop.");
}

main().catch(err => {
  console.error("❌ Aggregator fatal error:", err);
});
