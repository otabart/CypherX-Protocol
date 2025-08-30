import { NextResponse } from 'next/server';

interface AlchemyRequest {
  address: string;
  action: 'basic' | 'tokens' | 'transactions';
  page?: number;
  limit?: number;
  filter?: 'all' | 'incoming' | 'outgoing' | 'token_transfers' | 'internal' | 'failed';
  fromBlock?: number;
  toBlock?: number;
}

interface AssetTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  category: string;
  metadata?: {
    blockTimestamp: string;
    blockNum: string;
    logIndex: number;
  };
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  category: string;
  timestamp: number;
  blockNumber: string;
  type: 'incoming' | 'outgoing' | 'internal';
  description: string;
  amount: string;
  status: 'confirmed' | 'pending' | 'failed';
}



export async function POST(request: Request) {
  try {
    const body: AlchemyRequest = await request.json();
    const { address, action, page = 1, limit = 20, filter = 'all', fromBlock, toBlock } = body;

    if (!address) {
      return NextResponse.json({ 
        error: 'Missing address parameter' 
      }, { status: 400 });
    }

    const alchemyUrl = 'https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN';

    let result;
    
    switch (action) {
      case 'basic':
        // Get basic wallet info
        const batchBasic = [
          { jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
          { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
          { jsonrpc: "2.0", method: "eth_getTransactionCount", params: [address, "latest"], id: 3 },
          { jsonrpc: "2.0", method: "eth_getCode", params: [address, "latest"], id: 4 },
          { jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 5 },
        ];

        const basicResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batchBasic),
        });

        if (!basicResp.ok) {
          throw new Error(`Alchemy API error: ${basicResp.status}`);
        }

        result = await basicResp.json();
        break;

      case 'tokens':
        // Get token balances using Alchemy's getTokenBalances
        console.log(`Fetching tokens for address: ${address}`);
        
        const tokenRequest = {
          jsonrpc: "2.0",
          method: "alchemy_getTokenBalances",
          params: [address, "erc20"],
          id: 1
        };

        const tokenResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokenRequest),
        });

        if (!tokenResp.ok) {
          throw new Error(`Failed to get token balances: ${tokenResp.status}`);
        }

        const tokenData = await tokenResp.json();
        
        if (tokenData.error) {
          throw new Error(`Alchemy error: ${tokenData.error.message}`);
        }

        // Get metadata for tokens with non-zero balances
        const tokenBalances = [];
        if (tokenData.result && tokenData.result.tokenBalances) {
          for (const token of tokenData.result.tokenBalances) {
            if (parseInt(token.tokenBalance, 16) > 0) {
              try {
                // Get token metadata
                const metadataRequest = {
                  jsonrpc: "2.0",
                  method: "alchemy_getTokenMetadata",
                  params: [token.contractAddress],
                  id: 2
                };

                const metadataResp = await fetch(alchemyUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(metadataRequest),
                });

                if (metadataResp.ok) {
                  const metadataData = await metadataResp.json();
                  if (metadataData.result) {
                    const metadata = metadataData.result;
                    const balance = parseInt(token.tokenBalance, 16) / Math.pow(10, metadata.decimals || 18);
                    
                    // Get token price and USD value from DexScreener
                    let priceUsd = 0;
                    let logo = metadata.logo;
                    
                    try {
                      const dexScreenerResp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.contractAddress}`);
                      if (dexScreenerResp.ok) {
                        const dexData = await dexScreenerResp.json();
                        const pair = dexData.pairs?.[0];
                        if (pair) {
                          // Get price from DexScreener
                          if (pair.priceUsd) {
                            priceUsd = parseFloat(pair.priceUsd);
                          }
                          
                          // Get logo from DexScreener using the same pattern as other parts of the app
                          if (!logo) {
                            logo = pair.info?.imageUrl || 
                                   pair.mediaContent?.previewImage?.small || 
                                   pair.baseToken?.image ||
                                   pair.baseToken?.logoURI ||
                                   pair.quoteToken?.logoURI;
                          }
                        }
                      }
                    } catch (error) {
                      console.log(`Error fetching DexScreener data for ${token.contractAddress}:`, error);
                    }
                    
                    // Calculate USD value
                    const usdValue = balance * priceUsd;
                    
                    // Only include tokens worth more than $0.01
                    if (usdValue >= 0.01) {
                      tokenBalances.push({
                        contractAddress: token.contractAddress,
                        name: metadata.name || 'Unknown Token',
                        symbol: metadata.symbol || 'UNK',
                        tokenBalance: balance.toString(),
                        decimals: (metadata.decimals || 18).toString(),
                        logo: logo || `https://dexscreener.com/base/${token.contractAddress}/logo.png`,
                        priceUsd: priceUsd,
                        usdValue: usdValue,
                        priceChange24h: 0 // We can add this later if needed
                      });
                    }
                  }
                }
              } catch (error) {
                console.log(`Error fetching metadata for token ${token.contractAddress}:`, error);
              }
            }
          }
        }

        // Sort by USD value (highest first)
        tokenBalances.sort((a, b) => b.usdValue - a.usdValue);

        result = { tokenBalances };
        console.log(`Token result: Found ${tokenBalances.length} tokens with value >= $0.01`);
        break;

      case 'transactions':
        // Get transaction history using Alchemy's getAssetTransfers
        console.log(`Fetching transactions for address: ${address}`);
        
        const maxCount = Math.min(limit * 2, 100); // Get more than needed to filter
        
                 // Get incoming transfers
         const incomingRequest = {
          jsonrpc: "2.0",
           method: "alchemy_getAssetTransfers",
           params: [{
             fromBlock: fromBlock ? `0x${fromBlock.toString(16)}` : "0x0",
             toBlock: toBlock ? `0x${toBlock.toString(16)}` : "latest",
             toAddress: address,
             category: ["external", "erc20"],
             withMetadata: true,
             maxCount: `0x${maxCount.toString(16)}`,
             order: "desc"
           }],
          id: 1
        };

         // Get outgoing transfers
         const outgoingRequest = {
          jsonrpc: "2.0",
           method: "alchemy_getAssetTransfers",
          params: [{
             fromBlock: fromBlock ? `0x${fromBlock.toString(16)}` : "0x0",
             toBlock: toBlock ? `0x${toBlock.toString(16)}` : "latest",
             fromAddress: address,
             category: ["external", "erc20"],
             withMetadata: true,
             maxCount: `0x${maxCount.toString(16)}`,
             order: "desc"
          }],
          id: 2
        };

        // Make both requests in parallel
        const [incomingResp, outgoingResp] = await Promise.all([
          fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(incomingRequest),
          }),
          fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(outgoingRequest),
          })
        ]);

        if (!incomingResp.ok || !outgoingResp.ok) {
          throw new Error(`Alchemy API error: ${incomingResp.status} / ${outgoingResp.status}`);
        }

        const incomingData = await incomingResp.json();
        const outgoingData = await outgoingResp.json();

        if (incomingData.error) {
          throw new Error(`Alchemy error: ${incomingData.error.message}`);
        }

        if (outgoingData.error) {
          throw new Error(`Alchemy error: ${outgoingData.error.message}`);
        }

                 // Combine and process transfers
         const allTransfers: (AssetTransfer & { type: string })[] = [];
         
         if (incomingData.result && incomingData.result.transfers) {
           incomingData.result.transfers.forEach((transfer: AssetTransfer) => {
             allTransfers.push({
               ...transfer,
               type: 'incoming'
             });
           });
         }
         
         if (outgoingData.result && outgoingData.result.transfers) {
           outgoingData.result.transfers.forEach((transfer: AssetTransfer) => {
             allTransfers.push({
               ...transfer,
               type: 'outgoing'
             });
           });
         }

         // Convert to our Transaction format
         const transactions: Transaction[] = allTransfers.map((transfer: AssetTransfer & { type: string }) => {
          const timestamp = transfer.metadata?.blockTimestamp ? 
            parseInt(transfer.metadata.blockTimestamp) : 
            Date.now();
          
          const amount = transfer.value ? 
            (parseInt(transfer.value, 16) / Math.pow(10, 18)).toString() : 
            '0';
          
          const type = transfer.type || 
            (transfer.to.toLowerCase() === address.toLowerCase() ? 'incoming' : 'outgoing');
          
          const description = type === 'incoming' ? 
            `Received ${amount} ${transfer.asset}` :
            `Sent ${amount} ${transfer.asset}`;

          return {
            hash: transfer.hash,
            from: transfer.from,
            to: transfer.to,
            value: transfer.value,
            asset: transfer.asset,
            category: transfer.category,
            timestamp,
            blockNumber: transfer.metadata?.blockNum || '0',
            type: type as 'incoming' | 'outgoing' | 'internal',
            description,
            amount,
            status: 'confirmed'
          };
        });

        // Apply filtering
        let filteredTxs = transactions;
        if (filter === 'incoming') {
          filteredTxs = transactions.filter(tx => tx.type === 'incoming');
        } else if (filter === 'outgoing') {
          filteredTxs = transactions.filter(tx => tx.type === 'outgoing');
        } else if (filter === 'token_transfers') {
          filteredTxs = transactions.filter(tx => tx.category === 'erc20');
         } else if (filter === 'internal') {
          filteredTxs = transactions.filter(tx => tx.category === 'internal');
        }

        // Sort by timestamp (newest first)
        filteredTxs.sort((a, b) => b.timestamp - a.timestamp);

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTxs = filteredTxs.slice(startIndex, endIndex);

        result = {
          transactions: paginatedTxs,
          totalCount: filteredTxs.length,
          page,
          limit,
          totalPages: Math.ceil(filteredTxs.length / limit),
          hasNextPage: endIndex < filteredTxs.length,
          hasPrevPage: page > 1
        };
        
        console.log(`Transaction result: Found ${filteredTxs.length} transactions, returning ${paginatedTxs.length}`);
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error in Alchemy API:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch wallet data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
