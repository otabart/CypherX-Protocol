import { NextResponse } from 'next/server';

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

interface Transfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  category: string;
  metadata: {
    blockTimestamp: string;
    blockNum: string;
  };
}

interface Transaction {
  id: string;
  from: string;
  to: string;
  value: string;
  tokenAmount: number;
  timestamp: number;
  blockNumber: number;
  tokenSymbol?: string;
  decimals?: number;
  hash: string;
}

async function rpc<T>(method: string, params: unknown[]): Promise<{ result?: T; error?: { message: string } }> {
  if (!alchemyUrl) {
    throw new Error('Alchemy API URL not configured');
  }

  const response = await fetch(alchemyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
  });

  return response.json();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolAddress: string }> }
) {
  try {
    const { poolAddress } = await params;
    
    if (!poolAddress) {
      return NextResponse.json({ error: 'Pool address is required' }, { status: 400 });
    }

    // Fetch transfers to/from the pool address
    const poolTransfersResponse = await rpc<{ transfers: Transfer[] }>('alchemy_getAssetTransfers', [
      {
        fromBlock: '0x0',
        toBlock: 'latest',
        toAddress: poolAddress,
        category: ['external', 'erc20'],
        maxCount: '0x32', // 50 in hex
      }
    ]);

    const poolFromTransfersResponse = await rpc<{ transfers: Transfer[] }>('alchemy_getAssetTransfers', [
      {
        fromBlock: '0x0',
        toBlock: 'latest',
        fromAddress: poolAddress,
        category: ['external', 'erc20'],
        maxCount: '0x32', // 50 in hex
      }
    ]);

    // Also fetch recent ETH transfers to get more transaction data
    const recentTransfersResponse = await rpc<{ transfers: Transfer[] }>('alchemy_getAssetTransfers', [
      {
        fromBlock: '0x0',
        toBlock: 'latest',
        category: ['external'],
        maxCount: '0x32', // 50 in hex
      }
    ]);

    // Combine all transfers
    const allTransfers = [
      ...(poolTransfersResponse.result?.transfers || []),
      ...(poolFromTransfersResponse.result?.transfers || []),
      ...(recentTransfersResponse.result?.transfers || [])
    ];

    // Remove duplicates and sort by timestamp
    const uniqueTransfers = allTransfers.filter((transfer, index, self) => 
      index === self.findIndex(t => t.hash === transfer.hash)
    ).sort((a, b) => parseInt(b.metadata.blockTimestamp) - parseInt(a.metadata.blockTimestamp));

    // Convert to our transaction format
    const transactions: Transaction[] = uniqueTransfers.map((transfer) => {
      const isETH = transfer.asset === 'ETH';
      const decimals = isETH ? 18 : 18; // Most tokens use 18 decimals, but this could be improved
      
      return {
        id: transfer.hash,
        from: transfer.from,
        to: transfer.to,
        value: transfer.value,
        tokenAmount: parseFloat(transfer.value) / Math.pow(10, decimals),
        timestamp: parseInt(transfer.metadata.blockTimestamp) * 1000,
        blockNumber: parseInt(transfer.metadata.blockNum),
        tokenSymbol: transfer.asset === 'ETH' ? 'ETH' : 'TOKEN',
        decimals: decimals,
        hash: transfer.hash,
      };
    });

    return NextResponse.json({ transactions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching pool transactions:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 