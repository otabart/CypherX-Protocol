import type { TokenHolder, Transaction } from '../types';

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
      rawContract?: {
        value: string;
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

export const getTopHolders = async (tokenAddress: string): Promise<TokenHolder[]> => {
  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`Fetching top holders for token address: ${tokenAddress} (Attempt ${retries + 1}/${maxRetries})`);

      const balanceMap: { [address: string]: number } = {};
      let pageKey: string | undefined = undefined;

      // Paginate through all ERC20 transfers for the token
      do {
        const requestBody: AssetTransfersRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              contractAddresses: [tokenAddress],
              category: ['erc20'],
              withMetadata: true,
              maxCount: '0x3E8', // 1000 transfers per request
              order: 'desc',
              pageKey: pageKey,
            },
          ],
        };

        console.log(`Requesting ERC20 transfer events for token ${tokenAddress}${pageKey ? ` with pageKey ${pageKey}` : ''}`);

        const response: Response = await fetch(ALCHEMY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();
        console.log(`Alchemy response for token transfers:`, data);

        if (!response.ok || data.error) {
          throw new Error(
            `Alchemy error: ${data.error?.message || 'Failed to fetch token transfers'}`
          );
        }

        const transfers = data.result.transfers;

        for (const transfer of transfers) {
          const { from, to, rawContract } = transfer;

          if (!rawContract || !rawContract.value) continue;

          const value = parseInt(rawContract.value, 16) / 1e18;

          if (from && from !== '0x0000000000000000000000000000000000000000') {
            balanceMap[from] = (balanceMap[from] || 0) - value;
          }

          if (to && to !== '0x0000000000000000000000000000000000000000') {
            balanceMap[to] = (balanceMap[to] || 0) + value;
          }
        }

        pageKey = data.result.pageKey;
      } while (pageKey);

      // Convert balance map to TokenHolder array
      const holders: TokenHolder[] = Object.entries(balanceMap)
        .filter(([, balance]) => balance > 0)
        .map(([address, balance]) => ({
          address,
          balance: balance.toString(),
        }))
        .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
        .slice(0, 100);

      console.log(`Fetched ${holders.length} holders for token ${tokenAddress}:`, holders);
      return holders;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching top holders for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        throw error;
      }
      console.warn(`Retrying fetch for token ${tokenAddress} (${retries}/${maxRetries}) due to error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
    }
  }

  // Fallback return to prevent breaking the app
  console.error(`Failed to fetch top holders for ${tokenAddress} after all retries. Returning empty array.`);
  return [];
};

export const getTotalSupply = async (tokenAddress: string): Promise<string> => {
  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }

  try {
    const requestBody: TokenMetadataRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenMetadata',
      params: [tokenAddress],
    };

    const response: Response = await fetch(ALCHEMY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data: TokenMetadataResponse = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        `Alchemy error: ${data.error?.message || 'Failed to fetch token metadata'}`
      );
    }

    const decimals = data.result.decimals || 18;
    const totalSupply = parseInt(data.result.totalSupply, 16) / Math.pow(10, decimals);
    console.log(`Fetched total supply for token ${tokenAddress}:`, totalSupply);
    return totalSupply.toString();
  } catch (error: any) {
    console.error(`Error fetching total supply for token ${tokenAddress}:`, error.message);
    return '0'; // Fallback value
  }
};

export const getHolderCount = async (tokenAddress: string): Promise<number> => {
  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`Fetching holder count for token address: ${tokenAddress} (Attempt ${retries + 1}/${maxRetries})`);

      const holdersSet = new Set<string>();
      let pageKey: string | undefined = undefined;

      do {
        const requestBody: AssetTransfersRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              contractAddresses: [tokenAddress],
              category: ['erc20'],
              withMetadata: true,
              maxCount: '0x3E8',
              order: 'desc',
              pageKey: pageKey,
            },
          ],
        };

        const response: Response = await fetch(ALCHEMY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data: AssetTransfersResponse = await response.json();

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
      } while (pageKey);

      const holderCount = holdersSet.size;
      console.log(`Fetched holder count for token ${tokenAddress}:`, holderCount);
      return holderCount;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Error fetching holder count for token ${tokenAddress} after ${maxRetries} retries:`, error.message);
        throw error;
      }
      console.warn(`Retrying fetch for token ${tokenAddress} (${retries}/${maxRetries}) due to error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
    }
  }

  // Fallback return
  console.error(`Failed to fetch holder count for ${tokenAddress} after all retries. Returning 0.`);
  return 0;
};

export const getWalletTransactions = async (walletAddress: string): Promise<Transaction[]> => {
  if (!ALCHEMY_API_URL) {
    throw new Error('Alchemy API URL is not defined in environment variables');
  }

  try {
    console.log(`Fetching transactions for wallet: ${walletAddress}`);

    const requestBody: AssetTransfersRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromAddress: walletAddress,
          toAddress: undefined,
          category: ['external', 'internal', 'erc20'],
          maxCount: '0x64',
          order: 'desc',
        },
      ],
    };

    console.log(`Requesting asset transfers for wallet ${walletAddress}`);

    const response: Response = await fetch(ALCHEMY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data: AssetTransfersResponse = await response.json();
    console.log(`Alchemy response for wallet ${walletAddress}:`, data);

    if (!response.ok || data.error) {
      throw new Error(
        `Alchemy error: ${data.error?.message || 'Failed to fetch asset transfers'}`
      );
    }

    const transactions: Transaction[] = data.result.transfers.map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value ? tx.value.toString() : '0',
      asset: tx.asset || 'ETH',
    }));

    console.log(`Fetched ${transactions.length} transactions for wallet ${walletAddress}:`, transactions);
    return transactions;
  } catch (error: any) {
    console.error(`Error fetching transactions for wallet ${walletAddress}:`, error.message);
    return []; // Fallback value
  }
};