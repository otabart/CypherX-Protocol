import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI as string;
const ALCHEMY_API_URL = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

const client = new MongoClient(MONGO_URI);
const dbName = "HomebaseDB";
const collectionName = "whale_transactions";

if (!MONGO_URI || !ALCHEMY_API_URL) {
    console.error("❌ Missing environment variables: Ensure MONGO_URI & ALCHEMY_API_URL are set.");
}

// Function to get token supply from CoinGecko for a given token address on Base chain
async function getTokenSupply(tokenAddress: string): Promise<number | null> {
    try {
        const response = await fetch(`${COINGECKO_API_URL}/coins/base/contract/${tokenAddress}`);
        const data = await response.json();
        return data.market_data?.circulating_supply || null;
    } catch (error) {
        console.error(`⚠️ Failed to fetch supply for ${tokenAddress}:`, error);
        return null;
    }
}

// Function to fetch latest block transactions from Alchemy API
async function fetchLatestTransactions() {
    if (!ALCHEMY_API_URL) {
        console.error("❌ Missing Alchemy API URL.");
        return;
    }

    try {
        const blockResponse = await fetch(ALCHEMY_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getBlockByNumber",
                params: ["latest", true], // Fetch latest block with all transactions
            }),
        });

        const blockData = await blockResponse.json();

        if (!blockData.result || !blockData.result.transactions) {
            console.log("⚠️ No transactions found in the latest block.");
            return;
        }

        const transactions = blockData.result.transactions;
        console.log(`📥 Latest Block Transactions: ${transactions.length}`);

        if (transactions.length > 0) {
            await client.connect();
            const db = client.db(dbName);
            const collection = db.collection(collectionName);

            for (const tx of transactions) {
                if (!tx.value) continue; // Skip transactions with no value

                // Convert from Wei to BASE (assumed to be 18 decimals)
                let amount = parseFloat(tx.value) / 1e18;
                let isWhaleTx = false;
                let tokenSupply: number | null = null;
                let tokenAddress = "NATIVE"; // Default for native transactions
                let tokenSymbol = "ETH"; // Default symbol for native transfers

                // Detect ERC-20 Transfers (using the transfer function signature "0xa9059cbb")
                if (tx.to && tx.input && tx.input.startsWith("0xa9059cbb")) {
                    tokenAddress = tx.to;
                    tokenSupply = await getTokenSupply(tokenAddress);

                    if (tokenSupply) {
                        const transferAmount = parseInt(tx.input.slice(74), 16) / 1e18; // Convert from hex to decimal
                        amount = transferAmount;
                        // Apply both conditions: $5,000 minimum value and at least 0.04% of supply
                        // (Assuming a BASE price of ~$2.50 for conversion)
                        const valueCalculated = amount * 2.5;
                        isWhaleTx = (valueCalculated >= 5000) && ((amount / tokenSupply) >= 0.0004);
                    }

                    tokenSymbol = "UNKNOWN_TOKEN"; // Update as needed with proper token mapping
                } else {
                    // For native transactions, assume BASE price ~$2.50
                    isWhaleTx = (amount * 2.5) >= 5000;
                }

                if (isWhaleTx) {
                    // Round amount and value to 2 decimals
                    const roundedAmount = parseFloat(amount.toFixed(2));
                    const roundedValue = parseFloat((roundedAmount * 2.5).toFixed(2));
                    const roundedSupply = (tokenSupply && typeof tokenSupply === "number")
                        ? parseFloat(tokenSupply.toFixed(2))
                        : "N/A";

                    const transactionData = {
                        id: tx.hash,
                        wallet: tx.from,
                        token: tokenSymbol,
                        tokenAddress: tokenAddress,
                        amount: roundedAmount,
                        value: roundedValue,
                        type: tx.to ? "Buy" : "Sell",
                        tokenSupply: roundedSupply,
                        time: new Date().toISOString(),
                    };

                    console.log("🐋 WHALE TRANSACTION DETECTED:", transactionData);

                    // Save to MongoDB (avoid duplicates)
                    const exists = await collection.findOne({ id: transactionData.id });
                    if (!exists) {
                        await collection.insertOne(transactionData);
                    }
                }
            }
        }
    } catch (error) {
        console.error("❌ Error fetching block transactions:", error);
    }
}

// Run transaction fetcher every 10 seconds
setInterval(fetchLatestTransactions, 10_000);

// API Endpoint to Get Whale Transactions
export async function GET(req: NextRequest) {
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        console.log("📡 Fetching Whale Transactions...");

        // Paginate results
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = 10;
        const skip = (page - 1) * limit;

        const storedTransactions = await collection
            .find()
            .sort({ time: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return NextResponse.json(storedTransactions);
    } catch (error) {
        console.error("❌ Server Error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}



