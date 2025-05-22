import { NextResponse } from "next/server";

// Named export for the GET HTTP method
export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  // Await the params to resolve the Promise
  const { address } = await params;

  // Validate address
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

  if (!alchemyUrl) {
    return NextResponse.json(
      { error: "Alchemy API URL is missing. Set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local." },
      { status: 500 }
    );
  }

  try {
    // Fetch ETH Balance
    const balanceResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });
    const balanceData = await balanceResponse.json();
    if (balanceData.error) {
      throw new Error(balanceData.error.message);
    }
    const ethBalance = parseInt(balanceData.result, 16) / 1e18;

    // Fetch Transactions (Asset Transfers)
    const txResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            fromAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"],
            maxCount: "0x32", // 50 transfers
          },
        ],
        id: 2,
      }),
    });
    const txData = await txResponse.json();
    if (txData.error) {
      throw new Error(txData.error.message);
    }

    const txList = txData.result.transfers.map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to || "N/A",
      value: tx.value ? tx.value.toFixed(4) : "0",
      asset: tx.asset || "ETH",
      timestamp: tx.metadata?.blockTimestamp || "N/A",
    }));

    // Fetch Token Balances
    const tokenBalanceResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address, "erc20"],
        id: 3,
      }),
    });
    const tokenBalanceData = await tokenBalanceResponse.json();
    if (tokenBalanceData.error) {
      throw new Error(tokenBalanceData.error.message);
    }

    const tokens = await Promise.all(
      tokenBalanceData.result.tokenBalances.map(async (token: any) => {
        const metadataResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getTokenMetadata",
            params: [token.contractAddress],
            id: 4,
          }),
        });
        const metadata = await metadataResponse.json();
        if (metadata.error) {
          throw new Error(metadata.error.message);
        }

        const balance = parseInt(token.tokenBalance, 16) / Math.pow(10, metadata.result.decimals || 18);
        return {
          name: metadata.result.name || "Unknown Token",
          symbol: metadata.result.symbol || "N/A",
          balance: balance.toFixed(4),
          contractAddress: token.contractAddress,
        };
      })
    );

    // Return the wallet data (without NFTs)
    return NextResponse.json({
      ethBalance,
      tokens: tokens.filter((token: any) => parseFloat(token.balance) > 0),
      txList,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in /api/wallet/[address]:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}