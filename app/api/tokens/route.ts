import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data/tokens.json");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'all', 'clanker', 'zora', 'aerodrome', 'baseswap', 'uniswap'
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Load tokens from database
    if (!fs.existsSync(DB_FILE)) {
      return new Response(JSON.stringify({ 
        tokens: [], 
        total: 0,
        message: "No tokens found. Run token-monitor first." 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    let tokens = data.tokens || [];

    // Filter by source
    if (source && source !== 'all') {
      tokens = tokens.filter((token: any) => token.source === source);
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

    // Pagination
    const total = tokens.length;
    const paginatedTokens = tokens.slice(offset, offset + limit);

    // Add tags to tokens
    const tokensWithTags = paginatedTokens.map((token: any) => {
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
      total,
      offset,
      limit,
      source: source || 'all',
      stats: data.stats || {}
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