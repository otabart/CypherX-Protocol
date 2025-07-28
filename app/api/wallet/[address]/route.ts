// app/api/wallet/[address]/route.ts
import { NextResponse } from 'next/server';

// Generic JSON-RPC response type
type RpcResponse<T> = {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

// Asset transfer shape returned by Alchemy
interface Transfer {
  hash: string;
  from: string;
  to?: string;
  value: string;
  asset?: string;
  metadata?: { blockTimestamp: string };
}

// ERC-20 token balance entry
interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

// Token metadata returned by Alchemy
interface TokenMetadataResult {
  name?: string;
  symbol?: string;
  decimals?: number;
}

export async function GET(
  _request: Request,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  // Validate Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid wallet address' },
      { status: 400 }
    );
  }

  // Ensure Alchemy URL is defined
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;
  if (!alchemyUrl) {
    return NextResponse.json(
      { error: 'Alchemy API URL is missing. Set NEXT_PUBLIC_ALCHEMY_API_URL.' },
      { status: 500 }
    );
  }
  const baseUrl = alchemyUrl; // now known to be string

  // Helper to call JSON-RPC
  async function rpc<T>(method: string, params: unknown[]): Promise<RpcResponse<T>> {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });
    return (await response.json()) as RpcResponse<T>;
  }

  try {
    // 1) ETH balance
    const balanceResp = await rpc<string>('eth_getBalance', [address, 'latest']);
    if (balanceResp.error) throw new Error(balanceResp.error.message);
    const ethBalance = parseInt(balanceResp.result ?? '0', 16) / 1e18;

    // 2) Asset transfers
    const txResp = await rpc<{ transfers: Transfer[] }>('alchemy_getAssetTransfers', [
      { fromBlock: '0x0', toBlock: 'latest', fromAddress: address, category: ['external'], maxCount: '0x32' }
    ]);
    if (txResp.error) throw new Error(txResp.error.message);
    const txList = (txResp.result?.transfers ?? []).map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to ?? 'N/A',
      value: (Number(tx.value) / 1e18).toFixed(4),
      asset: tx.asset ?? 'ETH',
      timestamp: tx.metadata?.blockTimestamp ?? 'N/A',
    }));

    // 3) ERC-20 token balances
    const tokenBalResp = await rpc<{ tokenBalances: TokenBalance[] }>('alchemy_getTokenBalances', [address, 'erc20']);
    if (tokenBalResp.error) throw new Error(tokenBalResp.error.message);

    const tokens = await Promise.all(
      (tokenBalResp.result?.tokenBalances ?? []).map(async ({ contractAddress, tokenBalance }) => {
        const metaResp = await rpc<{ result: TokenMetadataResult }>('alchemy_getTokenMetadata', [contractAddress]);
        if (metaResp.error) throw new Error(metaResp.error.message);
        const meta = metaResp.result?.result;
        const decimals = meta?.decimals ?? 18;
        const balance = parseInt(tokenBalance, 16) / Math.pow(10, decimals);
        return {
          name: meta?.name ?? 'Unknown Token',
          symbol: meta?.symbol ?? 'N/A',
          balance: balance.toFixed(4),
          contractAddress,
        };
      })
    );

    // Filter out zero balances
    const nonZeroTokens = tokens.filter((t) => parseFloat(t.balance) > 0);

    return NextResponse.json({ ethBalance, tokens: nonZeroTokens, txList });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in /api/wallet/[address]:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}


