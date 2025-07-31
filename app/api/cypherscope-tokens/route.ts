import { adminDb } from "@/lib/firebase-admin";
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data/zora-tokens.json");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    let tokens: any[] = [];

    // Try Firebase first
  try {
    const db = adminDb();
      if (db) {
    const snapshot = await db.collection("Cypherscope")
          .orderBy("createdAt", "desc")
          .limit(limit)
          .offset(offset)
      .get();

        tokens = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            address: data.address,
            name: data.name,
            symbol: data.symbol,
            marketCap: data.marketCap,
            volume24h: data.volume24h,
            uniqueHolders: data.uniqueHolders,
            totalSupply: data.totalSupply,
            creatorAddress: data.creatorAddress,
            createdAt: data.createdAt,
            mediaContent: data.mediaContent,
            source: data.source || 'zora',
            dexName: data.dexName || 'Zora',
            pairAddress: data.pairAddress,
            description: data.description || "",
            website: data.website || "",
            telegram: data.telegram || "",
            twitter: data.twitter || "",
            totalVolume: data.totalVolume,
            marketCapDelta24h: data.marketCapDelta24h,
            tokenUri: data.tokenUri,
            lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
          };
        });
      }
    } catch (error) {
      console.log("Firebase failed, trying local file...");
    }

    // Always try local file first for Zora data
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const localTokens = data.tokens || [];
        console.log(`Loaded ${localTokens.length} tokens from local file`);
        
        // Merge Firebase and local tokens, prioritizing local data
        const localTokenAddresses = new Set(localTokens.map((t: any) => t.address));
        const firebaseTokensNotInLocal = tokens.filter((t: any) => !localTokenAddresses.has(t.address));
        tokens = [...localTokens, ...firebaseTokensNotInLocal];
      } catch (error) {
        console.error("Error reading local file:", error);
      }
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      tokens = tokens.filter((token: any) => 
        token.name?.toLowerCase().includes(searchLower) ||
        token.symbol?.toLowerCase().includes(searchLower) ||
        token.address?.toLowerCase().includes(searchLower)
      );
    }

    // Sort tokens
    tokens.sort((a: any, b: any) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'createdAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortBy === 'marketCap' || sortBy === 'volume24h') {
        aVal = parseFloat(aVal || '0');
        bVal = parseFloat(bVal || '0');
      }
      
      if (sortOrder === 'desc') {
        return bVal - aVal;
      } else {
        return aVal - bVal;
      }
    });

    // Add tags to tokens
    const tokensWithTags = tokens.map((token: any) => {
      const tags = [];
      
      // Add source tag
      tags.push(token.source.toUpperCase());
      
      // Add market cap tags
      const marketCap = parseFloat(token.marketCap || '0');
      if (marketCap > 1000000) tags.push('HIGH_CAP');
      if (marketCap > 100000) tags.push('MEDIUM_CAP');
      if (marketCap < 100000) tags.push('LOW_CAP');
      
      // Add volume tags
      const volume = parseFloat(token.volume24h || '0');
      if (volume > 100000) tags.push('HIGH_VOLUME');
      if (volume > 50000) tags.push('MEDIUM_VOLUME');
      
      // Add holder tags
      const holders = parseInt(token.uniqueHolders || '0');
      if (holders > 1000) tags.push('MANY_HOLDERS');
      if (holders > 100) tags.push('SOME_HOLDERS');
      
      return {
        ...token,
        tags
      };
    });

    return new Response(JSON.stringify({
      tokens: tokensWithTags,
      total: tokensWithTags.length,
      offset,
      limit
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch tokens";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 