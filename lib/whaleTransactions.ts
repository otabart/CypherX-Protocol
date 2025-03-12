import fetch from "node-fetch";
import { ethers, JsonRpcProvider } from "ethers";

// Your Alchemy endpoint for Base
const ALCHEMY_BASE_URL =
  "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
// Use CoinGecko for token pricing – set via environment variable or default value
const COINGECKO_API_URL =
  process.env.NEXT_PUBLIC_COINGECKO_API_URL || "https://api.coingecko.com/api/v3";

/**
 * Fetch asset transfers from Alchemy.
 */
async function fetchAssetTransfers() {
  const body = {
    id: 1,
    jsonrpc: "2.0",
    method: "alchemy_getAssetTransfers",
    params: [
      {
        fromBlock: "0x0",
        toBlock: "latest",
        category: ["erc20"],
        excludeZeroValue: true,
        maxCount: "0x3e8",
      },
    ],
  };

  const res = await fetch(ALCHEMY_BASE_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log("Raw response from Alchemy:", json);

  if (json.error) {
    console.error("Alchemy error response:", json.error);
    throw new Error(
      `Alchemy API error: ${json.error?.message || JSON.stringify(json.error)}`
    );
  }
  if (!json.result || !json.result.transfers) {
    console.error("Full response:", json);
    throw new Error("No transfers field in result");
  }
  return json.result.transfers;
}

/**
 * Use CoinGecko to fetch token price in USD.
 */
async function fetchTokenPriceFromCoingecko(symbol: string): Promise<number> {
  const tokenIdMapping: Record<string, string> = {
    USDC: "usd-coin",
    ETH: "ethereum",
    BONK: "bonk",
    BLD: "bld", // Mapping for BLD token.
  };
  const coinId = tokenIdMapping[symbol.toUpperCase()];
  if (!coinId) {
    console.warn(`No CoinGecko mapping found for token symbol: ${symbol}`);
    return 0;
  }
  const url = `${COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=usd`;
  const res = await fetch(url);
  const data = await res.json();
  return data[coinId]?.usd ?? 0;
}

/**
 * Fetch token supply from blockchain using ethers.
 * We manually specify the network as Base (chainId 8453).
 */
async function fetchTokenSupply(tokenAddress: string): Promise<bigint> {
  const erc20Abi = [
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];
  const provider = new JsonRpcProvider(ALCHEMY_BASE_URL, {
    name: "base",
    chainId: 8453,
  });
  const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
  return await contract.totalSupply();
}

/**
 * Main function: Get transactions meeting whale criteria.
 * For testing, we relax criteria (usdValue >= 1).
 * This version deduplicates transfers by hash.
 */
export async function getTransactions() {
  let transfers;
  try {
    transfers = await fetchAssetTransfers();
  } catch (err) {
    console.error("Error fetching asset transfers:", err);
    return [];
  }

  // Deduplicate transfers by hash.
  const uniqueTransfers = transfers.filter(
    (t, i, arr) => arr.findIndex((x) => x.hash === t.hash) === i
  );

  const transactions: any[] = [];
  let errorCount = 0;
  const maxErrorsToLog = 1;
  let loggedMissing = false;

  const processPromises = uniqueTransfers.map(async (transfer: any) => {
    // Get asset address from transfer.assetAddress or transfer.rawContract.address.
    const assetAddr =
      transfer.assetAddress ||
      (transfer.rawContract && transfer.rawContract.address);
    console.log("Processing transfer", transfer.hash, "assetAddr:", assetAddr);
    
    // Check required fields.
    if (!transfer.value || !assetAddr || !transfer.asset) {
      if (!loggedMissing) {
        console.log(
          "Skipping transfer due to missing fields:",
          transfer.hash,
          "Available keys:",
          Object.keys(transfer)
        );
        loggedMissing = true;
      }
      return null;
    }
    
    try {
      const amountBN = BigInt(transfer.value);
      const decimals = 18;
      const amount = parseFloat(ethers.formatUnits(amountBN, decimals));

      // Get token price.
      const price = await fetchTokenPriceFromCoingecko(transfer.asset);
      const usdValue = amount * price;

      // Get token supply.
      const tokenSupplyBN = await fetchTokenSupply(assetAddr);
      const tokenSupply = parseFloat(ethers.formatUnits(tokenSupplyBN, decimals));
      const supplyThreshold = tokenSupply * 0.002; // 0.2%

      // For testing, relax criteria (usdValue >= 1).
      if (usdValue >= 1) {
        return {
          id: transfer.hash,
          wallet: transfer.from,
          token: transfer.asset,
          amount,
          value: usdValue,
          type: "Buy",
          tokenSupply,
          time: new Date().toISOString(),
        };
      }
      return null;
    } catch (err) {
      if (errorCount < maxErrorsToLog) {
        console.error("Error processing transfer with hash:", transfer.hash, err);
      }
      errorCount++;
      return null;
    }
  });

  const results = await Promise.all(processPromises);
  results.forEach((result) => {
    if (result !== null) transactions.push(result);
  });
  if (errorCount > 0) {
    console.error(`Total errors encountered: ${errorCount}`);
  }
  return transactions;
}

/**
 * Helper: Inspect a sample transfer.
 */
export async function inspectTransfers() {
  try {
    const transfers = await fetchAssetTransfers();
    if (transfers.length > 0) {
      console.dir(transfers[0], { depth: null });
    } else {
      console.log("No transfers returned.");
    }
  } catch (error) {
    console.error("Error inspecting transfers:", error);
  }
}

// Uncomment the following line during development to inspect a sample transfer:
// inspectTransfers();
