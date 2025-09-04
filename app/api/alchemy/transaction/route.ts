import { NextResponse } from 'next/server';

interface TransactionDetails {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  gasLimit: string;
  gasFeeEth: number;
  gasFeeUsd: number;
  nonce: number;
  inputData: string;
  transactionIndex: number;
  status: "success" | "failed" | "pending";
  timestamp: number;
  ethValueUsd: number;
  contractAddress?: string;
  contractName?: string;
  methodSignature?: string;
  isContractCreation: boolean;
  tokenTransfers: Array<{
    from: string;
    to: string;
    value: string;
    asset: string;
    category: string;
  }>;
  receipt: {
    status: string;
    gasUsed: string;
    logs: Array<{
      address: string;
      topics: string[];
      data: string;
      logIndex: string;
      transactionIndex: string;
      transactionHash: string;
      blockHash: string;
      blockNumber: string;
    }>;
    contractAddress?: string;
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('hash');
    
    if (!txHash) {
      return NextResponse.json({ 
        error: 'Transaction hash is required' 
      }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ 
        error: 'Invalid transaction hash format' 
      }, { status: 400 });
    }

    const alchemyUrl = 'https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN';

    // Get transaction details
    const txResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionByHash",
        params: [txHash],
        id: 1,
      }),
    });

    if (!txResponse.ok) {
      throw new Error(`Alchemy API error: ${txResponse.status}`);
    }

    const txData = await txResponse.json();
    if (!txData?.result) {
      return NextResponse.json({ 
        error: 'Transaction not found' 
      }, { status: 404 });
    }

    const tx = txData.result;

    // Get transaction receipt
    const receiptResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
        id: 2,
      }),
    });

    const receiptData = await receiptResponse.json();
    const receipt = receiptData?.result;

    // Get block for timestamp
    const blockResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: [tx.blockNumber, false],
        id: 3,
      }),
    });

    const blockData = await blockResponse.json();
    const block = blockData?.result;

    // Get ETH price for USD calculations
    let ethPrice = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const priceData = await priceResponse.json();
      ethPrice = priceData.ethereum?.usd || 0;
    } catch (error) {
      console.warn('Failed to fetch ETH price:', error);
    }

    // Calculate values
    const ethValue = parseInt(tx.value, 16) / 1e18;
    const gasUsed = parseInt(receipt?.gasUsed || '0', 16);
    const gasPrice = parseInt(tx.gasPrice, 16) / 1e9; // Convert to Gwei
    const gasLimit = parseInt(tx.gas, 16);
    const gasFeeEth = (gasUsed * gasPrice * 1e-9) / 1e18;
    const gasFeeUsd = gasFeeEth * ethPrice;
    const ethValueUsd = ethValue * ethPrice;

    // Determine transaction status
    let status: "success" | "failed" | "pending" = "pending";
    if (receipt) {
      status = receipt.status === "0x1" ? "success" : "failed";
    }

    // Get timestamp
    const timestamp = block ? parseInt(block.timestamp, 16) * 1000 : Date.now();

    // Parse method signature from input data
    let methodSignature = '';
    if (tx.input && tx.input !== '0x' && tx.input.length >= 10) {
      const methodId = tx.input.slice(0, 10);
      // Common method signatures
      const commonMethods: { [key: string]: string } = {
        '0xa9059cbb': 'transfer(address,uint256)',
        '0x23b872dd': 'transferFrom(address,address,uint256)',
        '0x095ea7b3': 'approve(address,uint256)',
        '0x70a08231': 'balanceOf(address)',
        '0x18160ddd': 'totalSupply()',
        '0x06fdde03': 'name()',
        '0x95d89b41': 'symbol()',
        '0x313ce567': 'decimals()',
      };
      methodSignature = commonMethods[methodId] || `Unknown method (${methodId})`;
    }

    const transactionDetails: TransactionDetails = {
      hash: tx.hash || txHash,
      blockNumber: parseInt(tx.blockNumber, 16) || 0,
      blockHash: tx.blockHash || "N/A",
      from: tx.from || "N/A",
      to: tx.to || "N/A",
      value: ethValue.toString(),
      gas: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      gasUsed: gasUsed.toString(),
      gasLimit: gasLimit.toString(),
      gasFeeEth,
      gasFeeUsd,
      nonce: parseInt(tx.nonce, 16) || 0,
      inputData: tx.input || "0x",
      transactionIndex: parseInt(tx.transactionIndex, 16) || 0,
      status,
      timestamp,
      ethValueUsd,
      contractAddress: receipt?.contractAddress || undefined,
      contractName: undefined, // Could be enhanced with contract name lookup
      methodSignature: methodSignature || undefined,
      isContractCreation: !!receipt?.contractAddress,
      tokenTransfers: [], // Could be enhanced to fetch token transfers
      receipt: {
        status: receipt?.status || "0x0",
        gasUsed: gasUsed.toString(),
        logs: receipt?.logs || [],
        contractAddress: receipt?.contractAddress,
      },
    };

    return NextResponse.json({
      success: true,
      transaction: transactionDetails
    });

  } catch (error: unknown) {
    console.error('Error fetching transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: `Failed to fetch transaction: ${errorMessage}` 
    }, { status: 500 });
  }
}
