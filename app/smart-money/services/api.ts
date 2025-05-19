import type { TokenHolder, Transaction, TokenMetadata } from '../types';

// Alchemy API URL from environment variable
const ALCHEMY_API_URL = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

// Mock data flag (set to true to use mock data for testing)
const USE_MOCK_DATA = true; // Toggle this to false to use real API calls

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
      rawContract?: {
        value: string;
        address?: string;
      };
      hash: string;
      asset?: string;
      value?: number;
    }>;
    pageKey?: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

// Interface for alchemy_getTokenMetadata request
interface TokenMetadataRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'alchemy_getTokenMetadata';
  params: [string];
}

// Interface for alchemy_getTokenMetadata response
interface TokenMetadataResponse {
  result: {
    decimals?: number;
    totalSupply: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

// Interface for alchemy_getTokenBalances request
interface TokenBalancesRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'alchemy_getTokenBalances';
  params: [string, string[]];
}

// Interface for alchemy_getTokenBalances response
interface TokenBalancesResponse {
  result: {
    address: string;
    tokenBalances: Array<{
      contractAddress: string;
      tokenBalance: string;
      error?: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = 30000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000} seconds`);
    }
    throw error;
  }
};

// Mock data for testing
const mockHolders: TokenHolder[] = [
  { address: '0x1234567890abcdef1234567890abcdef12345678', balance: '1000', percentage: '10' },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', balance: '500', percentage: '5' },
  { address: '0x7890abcdef1234567890abcdef1234567890abcd', balance: '300', percentage: '3' },
];

const mockTransactions: Transaction[] = [
  { hash: '0xabc123...', from: '0x1234567890abcdef1234567890abcdef12345678', to: '0xdef456...', value: '100', asset: 'ETH' },
  { hash: '0xdef456...', from: '0x1234567890abcdef1234567890abcdef12345678', to: '0xghi789...', value: '50', asset: 'TOKEN' },
];

const mockTotalSupply = '10000';
const mockHolderCount = 50;
const mockTokenMetadata: TokenMetadata = { decimals: 18, totalSupply: '10000' };

export const getTopHolders = async (tokenAddress: string): Promise<TokenHolder[]> => {
  if (USE_MOCK_DATA) {
    console.log(`Returning mock holders for token ${tokenAddress}`);
    return mockHolders;
  }

  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  const maxRetries = 3;
  const maxPages = 10;
  let retries = 0;

  // Fetch total supply to calculate percentages
  let totalSupply = '0';
  try {
    totalSupply = await getTotalSupply(tokenAddress);
  } catch (err) {
    console.error(`Failed to fetch total supply for token ${tokenAddress}:`, err);
  }
  const totalSupplyNum = parseFloat(totalSupply) || 1; // Avoid division by zero

  while (retries < maxRetries) {
    try {
      console.log(`Fetching top holders for token address: ${tokenAddress} (Attempt ${retries + 1}/${maxRetries})`);

      // Step 1: Get all addresses involved in transfers
      const addressesSet = new Set<string>();
      let pageKey: string | undefined = undefined;
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
              maxCount: '0x3E8', // 1000 transfers
              order: 'desc',
              pageKey: pageKey,
            },
          ],
        };

        const response = await fetchWithTimeout(ALCHEMY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        console.log(`Asset transfers response for token ${tokenAddress} (page ${pageCount + 1}):`, data);

        if (!response.ok || data.error) {
          throw new Error(
            `Alchemy error: ${data.error?.message || 'Failed to fetch token transfers'}`
          );
        }

        const transfers = data.result.transfers;

        for (const transfer of transfers) {
          const { from, to } = transfer;
          if (from && from !== '0x0000000000000000000000000000000000000000') {
            addressesSet.add(from);
          }
          if (to && to !== '0x0000000000000000000000000000000000000000') {
            addressesSet.add(to);
          }
        }

        pageKey = data.result.pageKey;
        pageCount++;
      } while (pageKey);

      const addresses = Array.from(addressesSet);
      console.log(`Found ${addresses.length} unique addresses for token ${tokenAddress}`);

      if (addresses.length === 0) {
        console.log(`No addresses found for token ${tokenAddress}`);
        return [];
      }

      // Step 2: Fetch balances for these addresses individually
      const holders: TokenHolder[] = [];
      const batchSize = 10; // Smaller batches to avoid rate limits

      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        console.log(`Fetching balances for batch ${i / batchSize + 1} (${batch.length} addresses)`);

        const balancePromises = batch.map(async (address) => {
          const requestBody: TokenBalancesRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenBalances',
            params: [address, [tokenAddress]],
          };

          try {
            const batchResponse = await fetchWithTimeout(ALCHEMY_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            const batchData: TokenBalancesResponse = await batchResponse.json();
            console.log(`Token balances for address ${address}:`, batchData);

            if (!batchResponse.ok || batchData.error) {
              console.error(`Error fetching balance for ${address}: ${batchData.error?.message}`);
              return null;
            }

            const balance = batchData.result.tokenBalances[0];
            const balanceValue = balance.tokenBalance
              ? (parseInt(balance.tokenBalance, 16) / 1e18).toString()
              : '0';
            const balanceNum = parseFloat(balanceValue);
            if (balanceNum > 0) {
              const percentage = (balanceNum / totalSupplyNum) * 100;
              return {
                address,
                balance: balanceValue,
                percentage: percentage.toFixed(2),
              };
            }
            return null;
          } catch (err: any) {
            console.error(`Error fetching balance for address ${address}:`, err.message);
            return null;
          }
        });

        const batchHolders = await Promise.all(balancePromises);
        holders.push(...batchHolders.filter((holder): holder is TokenHolder => holder !== null));
      }

      // Sort and slice to top 100
      const sortedHolders = holders
        .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
        .slice(0, 100);

      console.log(`Fetched ${sortedHolders.length} holders for token ${tokenAddress}:`, sortedHolders);
      return sortedHolders;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching top holders for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return mockHolders; // Fallback to mock data
      }
      console.warn(`Retrying fetch for token ${tokenAddress} (${retries}/${maxRetries}) due to error:`, error.message);
      const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`Failed to fetch top holders for ${tokenAddress} after all retries. Returning mock data.`);
  return mockHolders;
};

export const getTotalSupply = async (tokenAddress: string): Promise<string> => {
  if (USE_MOCK_DATA) {
    console.log(`Returning mock total supply for token ${tokenAddress}`);
    return mockTotalSupply;
  }

  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: TokenMetadataResponse = await response.json();
      console.log(`Token metadata for ${tokenAddress}:`, data);

      if (!response.ok || data.error) {
        throw new Error(
          `Alchemy error: ${data.error?.message || 'Failed to fetch token metadata'}`
        );
      }

      const decimals = data.result.decimals || 18;
      const rawSupply = data.result.totalSupply;

      if (!rawSupply || isNaN(parseInt(rawSupply, 16))) {
        console.warn(`Invalid total supply for token ${tokenAddress}: ${rawSupply}`);
        return '0';
      }

      const totalSupply = parseInt(rawSupply, 16) / Math.pow(10, decimals);
      if (isNaN(totalSupply)) {
        console.warn(`Computed total supply is NaN for token ${tokenAddress}`);
        return '0';
      }

      console.log(`Fetched total supply for token ${tokenAddress}:`, totalSupply);
      return totalSupply.toString();
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching total supply for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return mockTotalSupply; // Fallback to mock data
      }
      console.warn(`Retrying total supply fetch for token ${tokenAddress} (${retries}/${maxRetries}):`, error.message);
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`Failed to fetch total supply for ${tokenAddress} after all retries. Returning mock data.`);
  return mockTotalSupply;
};

export const getTokenMetadata = async (tokenAddress: string): Promise<TokenMetadata> => {
  if (USE_MOCK_DATA) {
    console.log(`Returning mock token metadata for token ${tokenAddress}`);
    return mockTokenMetadata;
  }

  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: TokenMetadataResponse = await response.json();
      console.log(`Token metadata for ${tokenAddress}:`, data);

      if (!response.ok || data.error) {
        throw new Error(
          `Alchemy error: ${data.error?.message || 'Failed to fetch token metadata'}`
        );
      }

      return {
        decimals: data.result.decimals || 18,
        totalSupply: data.result.totalSupply,
      };
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching token metadata for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return mockTokenMetadata; // Fallback to mock data
      }
      console.warn(`Retrying token metadata fetch for token ${tokenAddress} (${retries}/${maxRetries}):`, error.message);
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`Failed to fetch token metadata for ${tokenAddress} after all retries. Returning mock data.`);
  return mockTokenMetadata;
};

export const getHolderCount = async (tokenAddress: string): Promise<number> => {
  if (USE_MOCK_DATA) {
    console.log(`Returning mock holder count for token ${tokenAddress}`);
    return mockHolderCount;
  }

  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  const maxRetries = 3;
  const maxPages = 10;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`Fetching holder count for token address: ${tokenAddress} (Attempt ${retries + 1}/${maxRetries})`);

      const holdersSet = new Set<string>();
      let pageKey: string | undefined = undefined;
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
              maxCount: '0x3E8', // 1000 transfers
              order: 'desc',
              pageKey: pageKey,
            },
          ],
        };

        const response = await fetchWithTimeout(ALCHEMY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        console.log(`Holder count transfers for token ${tokenAddress} (page ${pageCount + 1}):`, data);

        if (!response.ok || data.error) {
          throw new Error(
            `Alchemy error: ${data.error?.message || 'Failed to fetch token transfers for holder count'}`
          );
        }

        const transfers = data.result.transfers;

        for (const transfer of transfers) {
          const { from, to } = transfer;

          if (from && from !== '0x0000000000000000000000000000000000000000') {
            holdersSet.add(from);
          }
          if (to && to !== '0x0000000000000000000000000000000000000000') {
            holdersSet.add(to);
          }
        }

        pageKey = data.result.pageKey;
        pageCount++;
      } while (pageKey);

      const holderCount = holdersSet.size;
      console.log(`Fetched holder count for token ${tokenAddress}:`, holderCount);
      return holderCount;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching holder count for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        return mockHolderCount; // Fallback to mock data
      }
      console.warn(`Retrying holder count fetch for token ${tokenAddress} (${retries}/${maxRetries}):`, error.message);
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`Failed to fetch holder count for ${tokenAddress} after all retries. Returning mock data.`);
  return mockHolderCount;
};

export const getWalletTransactions = async (walletAddress: string): Promise<Transaction[]> => {
  if (USE_MOCK_DATA) {
    console.log(`Returning mock transactions for wallet ${walletAddress}`);
    return mockTransactions;
  }

  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }
  if (!isValidAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  const maxRetries = 3;
  const maxPages = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`Fetching transactions for wallet: ${walletAddress} (Attempt ${retries + 1}/${maxRetries})`);

      const transactions: Transaction[] = [];
      let pageKey: string | undefined = undefined;
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
              maxCount: '0x3E8', // 1000 transfers
              order: 'desc',
              pageKey: pageKey,
            },
          ],
        };

        console.log(`Requesting asset transfers for wallet ${walletAddress} (page ${pageCount + 1})`);

        const response = await fetchWithTimeout(ALCHEMY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        console.log(`Asset transfers response for wallet ${walletAddress} (page ${pageCount + 1}):`, data);

        if (!response.ok || data.error) {
          throw new Error(
            `Alchemy error: ${data.error?.message || 'Failed to fetch asset transfers'}`
          );
        }

        const transfers = data.result.transfers;
        transactions.push(
          ...transfers.map((tx) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value ? tx.value.toString() : (tx.rawContract?.value ? (parseInt(tx.rawContract.value, 16) / 1e18).toString() : '0'),
            asset: tx.asset || (tx.rawContract?.address ? 'TOKEN' : 'ETH'),
          }))
        );

        pageKey = data.result.pageKey;
        pageCount++;
      } while (pageKey);

      console.log(`Fetched ${transactions.length} transactions for wallet ${walletAddress}:`, transactions);
      return transactions;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching transactions for wallet ${walletAddress} after ${maxRetries} retries:`, error.message);
        return mockTransactions; // Fallback to mock data
      }
      console.warn(`Retrying transaction fetch for wallet ${walletAddress} (${retries}/${maxRetries}):`, error.message);
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`Failed to fetch transactions for ${walletAddress} after all retries. Returning mock data.`);
  return mockTransactions;
};