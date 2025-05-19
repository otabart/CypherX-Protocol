// Removed unused NextRequest import
import { NextResponse } from 'next/server';

// Define the TokenData type (same as in Indexes.tsx)
type TokenData = {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
};

// Helper function to fetch data from DEX Screener
async function fetchDexScreenerData(chainId: string, tokenAddresses: string[]): Promise<TokenData[]> {
  try {
    const url = `https://api.dexscreener.com/tokens/v1/${chainId}/${tokenAddresses.join(',')}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`DEX Screener API request failed with status ${response.status}`);
    }

    const data: any[] = await response.json();
    console.log('DEX Screener Response:', data); // Log for debugging

    // Map DEX Screener response to TokenData
    return data
      .filter((pair) => pair.baseToken && pair.priceUsd) // Ensure required fields exist
      .map((pair) => ({
        pairAddress: pair.pairAddress,
        baseToken: {
          address: pair.baseToken.address,
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
        },
        priceUsd: pair.priceUsd.toString(),
        priceChange: pair.priceChange ? { h24: pair.priceChange.h24 } : undefined,
        volume: pair.volume ? { h24: pair.volume.h24 } : undefined,
        marketCap: pair.marketCap,
        info: pair.info?.imageUrl ? { imageUrl: pair.info.imageUrl } : undefined,
      }));
  } catch (error) {
    console.error('Error fetching from DEX Screener:', error);
    return [];
  }
}

// Helper function to fetch data from CoinGecko as a fallback
async function fetchCoinGeckoData(chainId: string, tokenAddress: string): Promise<TokenData | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${chainId}/contract/${tokenAddress}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API request failed with status ${response.status}`);
    }

    const data: any = await response.json();
    console.log(`CoinGecko Response for ${tokenAddress}:`, data); // Log for debugging

    return {
      pairAddress: tokenAddress, // Use token address as pairAddress since CoinGecko doesn't provide it
      baseToken: {
        address: tokenAddress,
        name: data.name,
        symbol: data.symbol,
      },
      priceUsd: data.market_data.current_price.usd.toString(),
      priceChange: { h24: data.market_data.price_change_percentage_24h },
      volume: { h24: data.market_data.total_volume.usd },
      marketCap: data.market_data.market_cap.usd,
      info: data.image?.small ? { imageUrl: data.image.small } : undefined,
    };
  } catch (error) {
    console.error(`Error fetching from CoinGecko for ${tokenAddress}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const chainId = searchParams.get('chainId');
    const tokenAddresses = searchParams.get('tokenAddresses');

    if (!chainId || !tokenAddresses) {
      return NextResponse.json(
        { error: 'Missing chainId or tokenAddresses query parameters' },
        { status: 400 }
      );
    }

    if (chainId !== 'base') {
      return NextResponse.json(
        { error: 'Unsupported chainId. Only "base" is supported.' },
        { status: 400 }
      );
    }

    const addresses = tokenAddresses.split(',').map((addr) => addr.toLowerCase());

    // Step 1: Fetch data from DEX Screener (supports up to 30 addresses at once)
    let tokenData: TokenData[] = await fetchDexScreenerData(chainId, addresses);

    // Step 2: Identify tokens that weren't found in DEX Screener
    const foundAddresses = new Set(tokenData.map((token) => token.baseToken.address.toLowerCase()));
    const missingAddresses = addresses.filter((addr) => !foundAddresses.has(addr));

    // Step 3: Fetch missing tokens from CoinGecko
    if (missingAddresses.length > 0) {
      const coinGeckoPromises = missingAddresses.map((addr) => fetchCoinGeckoData(chainId, addr));
      const coinGeckoResults = await Promise.all(coinGeckoPromises);
      const validCoinGeckoData = coinGeckoResults.filter((result): result is TokenData => result !== null);
      tokenData = [...tokenData, ...validCoinGeckoData];
    }

    // Step 4: Filter to ensure we only return data for requested addresses
    tokenData = tokenData.filter((token) =>
      addresses.includes(token.baseToken.address.toLowerCase())
    );

    return NextResponse.json(tokenData, { status: 200 });
  } catch (error) {
    console.error('Error in /api/indexes:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}