// scripts/indexTokens.ts
import { ethers } from "ethers";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const BASE_RPC_URL = process.env.BASE_RPC_URL;
const MONGO_URI = process.env.MONGO_URI;

if (!BASE_RPC_URL || !MONGO_URI) {
  console.error("Missing BASE_RPC_URL or MONGO_URI in environment variables.");
  process.exit(1);
}

// Use WebSocketProvider instead of JsonRpcProvider
const wsProvider = new ethers.WebSocketProvider("wss://base-mainnet.g.alchemy.com/v2/YOUR_KEY");

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

async function fetchTokenTransfers(fromBlock: number, toBlock: number) {
  const filter = {
    topics: [TRANSFER_TOPIC],
    fromBlock,
    toBlock,
  };

  try {
    const logs = await wsProvider.getLogs(filter);
    console.log(`Fetched ${logs.length} logs from blocks ${fromBlock} to ${toBlock}`);
    return logs;
  } catch (error) {
    console.error("Error fetching logs:", error);
    return [];
  }
}

async function updateTokenMetrics(tokenAddress: string, transferValue: bigint) {
  const client = new MongoClient(MONGO_URI!);
  try {
    await client.connect();
    const db = client.db("BaseTokenDB");
    const collection = db.collection("tokenMetrics");

    await collection.updateOne(
      { tokenAddress },
      {
        $inc: { transferCount: 1, volume: Number(transferValue) },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true }
    );
    console.log(`Updated metrics for ${tokenAddress}`);
  } catch (error) {
    console.error("Error updating token metrics:", error);
  } finally {
    await client.close();
  }
}

async function runIndexer() {
  const latestBlock = await wsProvider.getBlockNumber();
  const fromBlock = latestBlock - 100; // For example, the last 100 blocks
  const logs = await fetchTokenTransfers(fromBlock, latestBlock);
  for (const log of logs) {
    try {
      // The log data is a hex string representing the transfer value.
      const value = ethers.toBigInt(log.data);
      await updateTokenMetrics(log.address, value);
    } catch (error) {
      console.error("Error processing log:", error);
    }
  }
  console.log("Indexer run complete.");
}

runIndexer().catch(console.error);

