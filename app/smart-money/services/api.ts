import type { TokenHolder, Transaction, TokenMetadata } from '../types';

// Alchemy API URL from environment variable
const ALCHEMY_API_URL = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

// Interface for alchemy_getAssetTransfers request
interface AssetTransfersRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'alchemy_getAssetTransfers';
  params: [
    {
      contractAddresses?: string[];
      category: string[];
      withMetadata?: boolean;
      maxCount: string;
      order: 'asc' | 'desc';
      pageKey?: string;
      fromAddress?: string;
      toAddress?: string;
    }
  ];
}

// Interface for alchemy_getAssetTransfers response
interface AssetTransfersResponse {
  result: {
    transfers: Array<{
      from: string;
      to: string;
      rawContract?: { value: string; address?: string };
      hash: string;
      asset?: string;
      value?: number;
      metadata?: { blockTimestamp: string };
    }>;
    pageKey?: string;
  };
  error?: { code: number; message: string };
}

// Interface for alchemy_getTokenMetadata request/response
interface TokenMetadataRequest {
  jsonrpc: '2.0';
  id: 1;
  method: 'alchemy_getTokenMetadata';
  params: [string];
}

interface TokenMetadataResponse {
  result: { decimals?: number; totalSupply: string };
  error?: { code: number; message: string };
}

// Interface for alchemy_getTokenBalances request/response
interface TokenBalancesRequest {
  jsonrpc: '2.0';
  id: 1;
  method: 'alchemy_getTokenBalances';
  params: [string, string[]];
}

interface TokenBalancesResponse {
  result: {
    address: string;
    tokenBalances: Array<{
      contractAddress: string;
      tokenBalance: string;
      error?: string;
    }>;
  };
  error?: { code: number; message: string };
}

// Interface for eth_call request/response (fallback for totalSupply)
interface EthCallRequest {
  jsonrpc: '2.0';
  id: 1;
  method: 'eth_call';
  params: [
    {
      to: string;
      data: string;
    },
    'latest'
  ];
}

interface EthCallResponse {
  result: string;
  error?: { code: number; message: string };
}

const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Utility to add delay between requests to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = 60000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    console.log(`Fetch successful for ${url}: Status ${response.status}`);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    console.error(`Fetch failed for ${url}:`, error.message);
    if (error.name === 'AbortError') throw new Error(`Request timed out after ${timeout / 1000} seconds`);
    throw error;
  }
};

// Fallback to fetch totalSupply using eth_call
const getTotalSupplyFallback = async (tokenAddress: string): Promise<string> => {
  if (!ALCHEMY_API_URL) throw new Error('Alchemy API URL is not defined in environment variables');
  if (!isValidAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);

  try {
    // ABI for totalSupply function: keccak256("totalSupply()") = 0x18160ddd
    const callData = '0x18160ddd'; // Renamed to avoid confusion with response data
    const requestBody: EthCallRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: tokenAddress,
          data: callData,
        },
        'latest',
      ],
    };

    const response = await fetchWithTimeout(ALCHEMY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data: EthCallResponse = await response.json();
    if (!response.ok || data.error) {
      const errorMsg = data.error?.message || 'Failed to fetch total supply via eth_call';
      console.error(`Alchemy error for eth_call (token ${tokenAddress}): ${errorMsg}`);
      throw new Error(`Alchemy error: ${errorMsg}`);
    }

    const rawSupply = data.result;
    if (!rawSupply || rawSupply === '0x') {
      console.warn(`No total supply found for token ${tokenAddress} via eth_call`);
      return '0';
    }

    const totalSupply = parseInt(rawSupply, 16) / Math.pow(10, 18); // Assume 18 decimals as fallback
    if (isNaN(totalSupply)) {
      console.warn(`Invalid total supply for token ${tokenAddress} via eth_call`);
      return '0';
    }

    console.log(`Total supply (via eth_call) for token ${tokenAddress}: ${totalSupply}`);
    return totalSupply.toString();
  } catch (error: any) {
    console.error(`Error fetching total supply via eth_call for token ${tokenAddress}:`, error.message);
    return '0'; // Fallback to '0' if eth_call fails
  }
};

const getTopHolders = async (tokenAddress: string): Promise<TokenHolder[]> => {
  if (!ALCHEMY_API_URL) throw new Error('Alchemy API URL is not defined in environment variables');
  if (!isValidAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);

  const maxRetries = 3;
  const maxPages = 5; // Reduced to minimize compute unit usage
  let retries = 0;
  let totalSupply = '0';

  try {
    totalSupply = await getTotalSupply(tokenAddress);
  } catch (err) {
    console.error(`Failed to fetch total supply for token ${tokenAddress}:`, err);
  }
  const totalSupplyNum = parseFloat(totalSupply) || 1;

  while (retries < maxRetries) {
    try {
      const addressesSet = new Set<string>();
      let pageKey: string | undefined;
      let pageCount = 0;

      do {
        if (pageCount >= maxPages) {
          console.warn(`Reached max pages (${maxPages}) for token ${tokenAddress}. Stopping pagination.`);
          break;
        }

        const requestBody: AssetTransfersRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              contractAddresses: [tokenAddress],
              category: ['erc20'],
              withMetadata: true,
              maxCount: '0x1F4', // Reduced to 500 transfers to lower compute unit usage
              order: 'desc',
              pageKey,
            },
          ],
        };

        const response = await fetchWithTimeout(ALCHEMY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        if (!response.ok || data.error) {
          const errorMsg = data.error?.message || 'Failed to fetch token transfers';
          console.error(`Alchemy error for getAssetTransfers (token ${tokenAddress}): ${errorMsg}`);
          if (data.error?.code === -32005) { // Rate limit error
            throw new Error('Rate limit exceeded. Retrying with backoff.');
          }
          throw new Error(`Alchemy error: ${errorMsg}`);
        }

        const transfers = data.result.transfers;
        console.log(`Fetched ${transfers.length} transfers for token ${tokenAddress} (page ${pageCount + 1})`);
        for (const transfer of transfers) {
          if (transfer.from && transfer.from !== '0x0000000000000000000000000000000000000000') addressesSet.add(transfer.from);
          if (transfer.to && transfer.to !== '0x0000000000000000000000000000000000000000') addressesSet.add(transfer.to);
        }

        pageKey = data.result.pageKey;
        pageCount++;
        if (pageKey) await delay(1000); // Increased delay to 1000ms to avoid rate limits
      } while (pageKey);

      const addresses = Array.from(addressesSet);
      console.log(`Found ${addresses.length} unique addresses for token ${tokenAddress}`);
      if (addresses.length === 0) return [];

      const holders: TokenHolder[] = [];
      const batchSize = 5; // Reduced batch size to lower compute unit usage

      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const balancePromises = batch.map(async (address): Promise<TokenHolder | null> => {
          const requestBody: TokenBalancesRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenBalances',
            params: [address, [tokenAddress]],
          };

          try {
            const batchResponse = await fetchWithTimeout(ALCHEMY_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });

            const batchData: TokenBalancesResponse = await batchResponse.json();
            if (!batchResponse.ok || batchData.error) {
              console.error(`Error fetching balance for ${address}: ${batchData.error?.message}`);
              return null;
            }

            const balance = batchData.result.tokenBalances[0];
            if (balance.error) {
              console.warn(`Balance fetch error for ${address}: ${balance.error}`);
              return null;
            }

            const balanceValue = balance.tokenBalance ? (parseInt(balance.tokenBalance, 16) / 1e18).toString() : '0';
            const balanceNum = parseFloat(balanceValue);
            if (balanceNum <= 0) return null;

            const txs = await getWalletTransactions(address);
            const netFlow = txs.reduce((acc, tx) => {
              if (tx.asset !== 'ETH') {
                const value = parseFloat(tx.value);
                if (tx.to === address) return acc + value;
                if (tx.from === address) return acc - value;
              }
              return acc;
            }, 0);

            const percentage = (balanceNum / totalSupplyNum) * 100;
            return {
              address,
              balance: balanceValue,
              percentage: percentage.toFixed(2),
              netFlow: netFlow || 0,
            } as TokenHolder;
          } catch (err: any) {
            console.error(`Error fetching balance for address ${address}:`, err.message);
            return null;
          }
        });

        const batchHolders = (await Promise.all(balancePromises)).filter((holder): holder is TokenHolder => holder !== null);
        holders.push(...batchHolders);
        console.log(`Processed batch ${i / batchSize + 1}: Added ${batchHolders.length} holders`);
        if (i + batchSize < addresses.length) await delay(1500); // Increased delay to 1500ms
      }

      console.log(`Returning ${holders.length} top holders for token ${tokenAddress}`);
      return holders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance)).slice(0, 100);
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching top holders for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        throw new Error(`Failed to fetch top holders after ${maxRetries} retries: ${error.message}`);
      }
      console.warn(`Retrying fetch for token ${tokenAddress} (${retries}/${maxRetries}) due to error:`, error.message);
      const delayMs = Math.pow(2, retries) * 1000; // Exponential backoff: 1000ms, 2000ms, 4000ms
      await delay(delayMs);
    }
  }

  throw new Error('Unexpected error in getTopHolders');
};

const getTotalSupply = async (tokenAddress: string): Promise<string> => {
  if (!ALCHEMY_API_URL) throw new Error('Alchemy API URL is not defined in environment variables');
  if (!isValidAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const requestBody: TokenMetadataRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenMetadata',
        params: [tokenAddress],
      };

      const response = await fetchWithTimeout(ALCHEMY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data: TokenMetadataResponse = await response.json();
      if (!response.ok || data.error) {
        const errorMsg = data.error?.message || 'Failed to fetch token metadata';
        console.error(`Alchemy error for getTokenMetadata (token ${tokenAddress}): ${errorMsg}`);
        if (data.error?.code === -32005) { // Rate limit error
          throw new Error('Rate limit exceeded. Retrying with backoff.');
        }
        throw new Error(`Alchemy error: ${errorMsg}`);
      }

      const decimals = data.result.decimals || 18;
      const rawSupply = data.result.totalSupply;
      if (!rawSupply || isNaN(parseInt(rawSupply, 16))) {
        console.warn(`No total supply found for token ${tokenAddress} via alchemy_getTokenMetadata. Falling back to eth_call.`);
        return await getTotalSupplyFallback(tokenAddress); // Fallback to eth_call
      }

      const totalSupply = parseInt(rawSupply, 16) / Math.pow(10, decimals);
      if (isNaN(totalSupply)) {
        console.warn(`Invalid total supply for token ${tokenAddress}. Falling back to eth_call.`);
        return await getTotalSupplyFallback(tokenAddress);
      }

      console.log(`Total supply for token ${tokenAddress}: ${totalSupply}`);
      return totalSupply.toString();
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching total supply for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return await getTotalSupplyFallback(tokenAddress); // Final fallback to eth_call
      }
      console.warn(`Retrying total supply fetch for token ${tokenAddress} (${retries}/${maxRetries}):`, error.message);
      const delayMs = Math.pow(2, retries) * 1000;
      await delay(delayMs);
    }
  }

  return '0'; // Final fallback if all retries fail
};

const getTokenMetadata = async (tokenAddress: string): Promise<TokenMetadata> => {
  if (!ALCHEMY_API_URL) throw new Error('Alchemy API URL is not defined in environment variables');
  if (!isValidAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const requestBody: TokenMetadataRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenMetadata',
        params: [tokenAddress],
      };

      const response = await fetchWithTimeout(ALCHEMY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data: TokenMetadataResponse = await response.json();
      if (!response.ok || data.error) {
        const errorMsg = data.error?.message || 'Failed to fetch token metadata';
        console.error(`Alchemy error for getTokenMetadata (token ${tokenAddress}): ${errorMsg}`);
        if (data.error?.code === -32005) { // Rate limit error
          throw new Error('Rate limit exceeded. Retrying with backoff.');
        }
        throw new Error(`Alchemy error: ${errorMsg}`);
      }

      const metadata = {
        decimals: data.result.decimals || 18,
        totalSupply: data.result.totalSupply || '0',
      };
      console.log(`Token metadata for ${tokenAddress}:`, metadata);
      return metadata;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching token metadata for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return { decimals: 18, totalSupply: '0' }; // Fallback metadata
      }
      console.warn(`Retrying token metadata fetch for token ${tokenAddress} (${retries}/${maxRetries}):`, error.message);
      const delayMs = Math.pow(2, retries) * 1000;
      await delay(delayMs);
    }
  }

  return { decimals: 18, totalSupply: '0' }; // Final fallback
};

const getHolderCount = async (tokenAddress: string): Promise<number> => {
  if (!ALCHEMY_API_URL) throw new Error('Alchemy API URL is not defined in environment variables');
  if (!isValidAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);

  const maxRetries = 3;
  const maxPages = 5; // Reduced to minimize compute unit usage
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const holdersSet = new Set<string>();
      let pageKey: string | undefined;
      let pageCount = 0;

      do {
        if (pageCount >= maxPages) {
          console.warn(`Reached max pages (${maxPages}) for token ${tokenAddress}. Stopping pagination.`);
          break;
        }

        const requestBody: AssetTransfersRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              contractAddresses: [tokenAddress],
              category: ['erc20'],
              withMetadata: true,
              maxCount: '0x1F4', // Reduced to 500 transfers
              order: 'desc',
              pageKey,
            },
          ],
        };

        const response = await fetchWithTimeout(ALCHEMY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        if (!response.ok || data.error) {
          const errorMsg = data.error?.message || 'Failed to fetch token transfers for holder count';
          console.error(`Alchemy error for getAssetTransfers (holder count, token ${tokenAddress}): ${errorMsg}`);
          if (data.error?.code === -32005) { // Rate limit error
            throw new Error('Rate limit exceeded. Retrying with backoff.');
          }
          throw new Error(`Alchemy error: ${errorMsg}`);
        }

        const transfers = data.result.transfers;
        console.log(`Fetched ${transfers.length} transfers for holder count (token ${tokenAddress}, page ${pageCount + 1})`);
        for (const transfer of transfers) {
          if (transfer.from && transfer.from !== '0x0000000000000000000000000000000000000000') holdersSet.add(transfer.from);
          if (transfer.to && transfer.to !== '0x0000000000000000000000000000000000000000') holdersSet.add(transfer.to);
        }

        pageKey = data.result.pageKey;
        pageCount++;
        if (pageKey) await delay(1000); // Increased delay
      } while (pageKey);

      console.log(`Holder count for token ${tokenAddress}: ${holdersSet.size}`);
      return holdersSet.size;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching holder count for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return 0; // Fallback to 0
      }
      console.warn(`Retrying holder count fetch for token ${tokenAddress} (${retries}/${maxRetries}):`, error.message);
      const delayMs = Math.pow(2, retries) * 1000;
      await delay(delayMs);
    }
  }

  return 0; // Final fallback
};

const getWalletTransactions = async (walletAddress: string): Promise<Transaction[]> => {
  if (!ALCHEMY_API_URL) throw new Error('Alchemy API URL is not defined in environment variables');
  if (!isValidAddress(walletAddress)) throw new Error(`Invalid wallet address: ${walletAddress}`);

  const maxRetries = 3;
  const maxPages = 3; // Reduced to minimize compute unit usage
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const transactions: Transaction[] = [];
      let pageKey: string | undefined;
      let pageCount = 0;

      do {
        if (pageCount >= maxPages) {
          console.warn(`Reached max pages (${maxPages}) for wallet ${walletAddress}. Stopping pagination.`);
          break;
        }

        const requestBody: AssetTransfersRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromAddress: walletAddress,
              toAddress: undefined,
              category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
              maxCount: '0x1F4', // Reduced to 500 transfers
              order: 'desc',
              pageKey,
              withMetadata: true,
            },
          ],
        };

        const response = await fetchWithTimeout(ALCHEMY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        if (!response.ok || data.error) {
          const errorMsg = data.error?.message || 'Failed to fetch asset transfers';
          console.error(`Alchemy error for getAssetTransfers (wallet ${walletAddress}): ${errorMsg}`);
          if (data.error?.code === -32005) { // Rate limit error
            throw new Error('Rate limit exceeded. Retrying with backoff.');
          }
          throw new Error(`Alchemy error: ${errorMsg}`);
        }

        const transfers = data.result.transfers;
        console.log(`Fetched ${transfers.length} transfers for wallet ${walletAddress} (page ${pageCount + 1})`);
        transactions.push(
          ...transfers.map((tx) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value ? tx.value.toString() : tx.rawContract?.value ? (parseInt(tx.rawContract.value, 16) / 1e18).toString() : '0',
            asset: tx.asset || (tx.rawContract?.address ? 'TOKEN' : 'ETH'),
            timestamp: tx.metadata?.blockTimestamp ? new Date(tx.metadata.blockTimestamp).getTime() : Date.now(),
            isBuy: tx.to.toLowerCase() === walletAddress.toLowerCase(),
          }))
        );

        pageKey = data.result.pageKey;
        pageCount++;
        if (pageKey) await delay(1000); // Increased delay
      } while (pageKey);

      console.log(`Returning ${transactions.length} transactions for wallet ${walletAddress}`);
      return transactions;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching transactions for wallet ${walletAddress} after ${maxRetries} retries:`, error.message);
        return []; // Fallback to empty array
      }
      console.warn(`Retrying transaction fetch for wallet ${walletAddress} (${retries}/${maxRetries}):`, error.message);
      const delayMs = Math.pow(2, retries) * 1000;
      await delay(delayMs);
    }
  }

  return []; // Final fallback
};

// Consolidated exports
export {
  fetchWithTimeout,
  getTopHolders,
  getTotalSupply,
  getTokenMetadata,
  getHolderCount,
  getWalletTransactions,
};