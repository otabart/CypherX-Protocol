import { TwitterApi } from 'twitter-api-v2';
import * as schedule from 'node-schedule';
import * as dotenv from 'dotenv';
import { tokenMapping } from './tokenMapping'; // Import tokenMapping

// Load environment variables from root
dotenv.config({ path: '../.env' });

// Initialize Twitter client
const client = new TwitterApi({
  appKey: process.env.API_KEY!,
  appSecret: process.env.API_SECRET!,
  accessToken: process.env.ACCESS_TOKEN!,
  accessSecret: process.env.ACCESS_TOKEN_SECRET!,
});

// Types from TokenScanner
type DexToken = {
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  txns: { h24: { buys: number; sells: number } };
  priceChange: { h1?: number; h6?: number; h24?: number };
  volume: { h24: number };
  liquidity: { usd: number };
  marketCap?: number;
  pairCreatedAt?: number;
};

// Types from BaseAiIndex
type TokenData = {
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  priceChange?: { h24?: number };
  volume?: { h24: number };
  marketCap?: number;
};

type BaseAiToken = {
  symbol: string;
  address: string;
  weight: string;
};

// Static AI token list from BaseAiIndex
const baseAiTokens: BaseAiToken[] = [
  { symbol: "GAME", address: "0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3", weight: "4.86%" },
  { symbol: "BANKR", address: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b", weight: "5.24%" },
  { symbol: "FAI", address: "0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935", weight: "12.57%" },
  { symbol: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", weight: "26.8%" },
  { symbol: "CLANKER", address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb", weight: "15.89%" },
  { symbol: "KAITO", address: "0x98d0baa52b2D063E780DE12F615f963Fe8537553", weight: "16.22%" },
  { symbol: "COOKIE", address: "0xC0041EF357B183448B235a8Ea73Ce4E4eC8c265F", weight: "5.12%" },
  { symbol: "VVV", address: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", weight: "5.08%" },
  { symbol: "DRB", address: "0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2", weight: "3.8%" },
  { symbol: "AIXBT", address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825", weight: "10.5%" },
];

// Fetch tokens for TokenScanner (top winners/losers, new listings)
async function fetchScannerTokens(): Promise<DexToken[]> {
  try {
    const tokenAddresses = Object.values(tokenMapping).join(",");
    const res = await fetch(
      `http://localhost:3000/api/tokens?chainId=base&tokenAddresses=${tokenAddresses}`
    ); // Adjust URL for production
    if (!res.ok) throw new Error('Failed to fetch scanner tokens');
    const data: DexToken[] = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching scanner tokens:', error);
    return [];
  }
}

// Fetch tokens for Base AI Index
async function fetchAiIndexTokens(): Promise<TokenData[]> {
  try {
    const addresses = baseAiTokens.map((t) => t.address).join(",");
    const res = await fetch(
      `http://localhost:3000/api/tokens?chainId=base&tokenAddresses=${addresses}`
    ); // Adjust URL for production
    if (!res.ok) throw new Error('Failed to fetch AI index tokens');
    const data: TokenData[] = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching AI index tokens:', error);
    return [];
  }
}

// Hourly top winners/losers tweet
async function postMarketUpdate() {
  const tokens = await fetchScannerTokens();
  if (!tokens.length) {
    console.log('No tokens for market update');
    return;
  }

  const sortedByPriceChange = [...tokens].sort(
    (a, b) => (b.priceChange?.h24 ?? 0) - (a.priceChange?.h24 ?? 0)
  );
  const topWinners = sortedByPriceChange.slice(0, 3);
  const topLosers = sortedByPriceChange.slice(-3).reverse();

  const winnersText = topWinners
    .map((t) => `${t.baseToken.symbol} (${t.priceChange?.h24?.toFixed(2)}%)`)
    .join(', ');
  const losersText = topLosers
    .map((t) => `${t.baseToken.symbol} (${t.priceChange?.h24?.toFixed(2)}%)`)
    .join(', ');

  const tweet = `Hourly Update:\nTop Winners: ${winnersText}\nTop Losers: ${losersText}\n#Web3 #CryptoMarket`;
  try {
    const finalTweet = tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet;
    await client.v2.tweet(finalTweet);
    console.log('Market update posted:', finalTweet);
  } catch (error) {
    console.error('Error posting market update:', error);
  }
}

// Daily AI index update tweet
async function postAiIndexUpdate() {
  const tokens = await fetchAiIndexTokens();
  if (!tokens.length) {
    console.log('No tokens for AI index update');
    return;
  }

  let weightedPriceChangeSum = 0;
  let totalWeight = 0;
  let totalVolume = 0;
  let totalMarketCap = 0;

  baseAiTokens.forEach((token) => {
    const weightNum = parseFloat(token.weight.replace("%", ""));
    const fetched = tokens.find(
      (d) => d.baseToken.address.toLowerCase() === token.address.toLowerCase()
    );
    if (fetched) {
      if (fetched.priceChange?.h24 !== undefined) {
        weightedPriceChangeSum += weightNum * fetched.priceChange.h24;
        totalWeight += weightNum;
      }
      if (fetched.volume?.h24) totalVolume += fetched.volume.h24;
      if (fetched.marketCap) totalMarketCap += fetched.marketCap;
    }
  });

  const overallPriceChange = totalWeight > 0 ? weightedPriceChangeSum / totalWeight : undefined;
  const tweet = `Base AI Index Update:\n24h Change: ${overallPriceChange?.toFixed(2) ?? 'N/A'}%\nVolume: $${totalVolume.toLocaleString()}\nMarket Cap: $${totalMarketCap.toLocaleString()}\n#BaseAI #CryptoIndex`;
  try {
    const finalTweet = tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet;
    await client.v2.tweet(finalTweet);
    console.log('AI index update posted:', finalTweet);
  } catch (error) {
    console.error('Error posting AI index update:', error);
  }
}

// Daily new listings tweet
async function postNewListings() {
  const tokens = await fetchScannerTokens();
  const newTokens = tokens.filter(
    (t) => t.pairCreatedAt && Date.now() - t.pairCreatedAt < 24 * 60 * 60 * 1000
  );
  if (!newTokens.length) {
    console.log('No new listings to tweet');
    return;
  }

  const tweet = `New Listings: ${newTokens.map((t) => t.baseToken.symbol).join(', ')}\n#NewTokens #Web3`;
  try {
    const finalTweet = tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet;
    await client.v2.tweet(finalTweet);
    console.log('New listings posted:', finalTweet);
  } catch (error) {
    console.error('Error posting new listings:', error);
  }
}

// Whale transaction tweet (placeholder)
export async function postWhaleTransaction(amount: number, wallet: string) {
  const tweet = `Whale Alert: ${amount} moved by ${wallet}\n#WhaleWatch #Crypto`;
  try {
    await client.v2.tweet(tweet);
    console.log('Whale tweet posted:', tweet);
  } catch (error) {
    console.error('Error posting whale alert:', error);
  }
}

// Token support announcement
async function announceTokenSupport(symbol: string, address: string) {
  const tweet = `Token Support for ${symbol} (${symbol}) has been added to Homebase.\n\nCA: ${address}\n#TokenSupport #Homebase`;
  try {
    await client.v2.tweet(tweet);
    console.log('Token support announced:', tweet);
  } catch (error) {
    console.error('Error announcing token support:', error);
  }
}

// Track previously seen tokens
let previousTokens = new Set(Object.keys(tokenMapping));

// Check for new tokens every 5 minutes
async function checkForNewTokens() {
  const currentTokens = new Set(Object.keys(tokenMapping));
  const newTokens = [...currentTokens].filter((token) => !previousTokens.has(token));

  for (const symbol of newTokens) {
    const address = tokenMapping[symbol];
    await announceTokenSupport(symbol, address);
    console.log(`New token detected: ${symbol}`);
  }

  previousTokens = currentTokens; // Update the previous set
}

// Schedule tasks
schedule.scheduleJob('0 * * * *', postMarketUpdate); // Hourly winners/losers
schedule.scheduleJob('0 0 * * *', postAiIndexUpdate); // Daily AI index at midnight
schedule.scheduleJob('0 12 * * *', postNewListings); // New listings at noon
schedule.scheduleJob('*/5 * * * *', checkForNewTokens); // Check for new tokens every 5 minutes

console.log('Twitter bot started. Schedules active...');

// Test announcement for $DOOG
announceTokenSupport('$DOOG', '0x34b2adb3bd4aef3af0b4541735c47b6364d88d1e');