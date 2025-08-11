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

interface LogEntry {
  address?: string;
  transactionHash?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  logIndex?: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  input?: string;
  blockNumber?: string;
  status?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  fromName?: string;
  toName?: string;
}

// Helper function to decode hex string to readable text
function decodeHexString(hex: string): string {
  try {
    // Remove '0x' prefix and convert to bytes
    const hexWithoutPrefix = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    // Handle dynamic string encoding (first 32 bytes are offset, next 32 are length)
    if (hexWithoutPrefix.length >= 128) {
      const length = parseInt(hexWithoutPrefix.slice(64, 128), 16);
      const data = hexWithoutPrefix.slice(128, 128 + length * 2);
      
      // Convert hex to string
      let result = '';
      for (let i = 0; i < data.length; i += 2) {
        const charCode = parseInt(data.substr(i, 2), 16);
        if (charCode >= 32 && charCode <= 126) { // Printable ASCII
          result += String.fromCharCode(charCode);
        }
      }
      return result.trim();
    } else {
      // Simple hex to string conversion
      let result = '';
      for (let i = 0; i < hexWithoutPrefix.length; i += 2) {
        const charCode = parseInt(hexWithoutPrefix.substr(i, 2), 16);
        if (charCode >= 32 && charCode <= 126) { // Printable ASCII
          result += String.fromCharCode(charCode);
        }
      }
      return result.trim();
    }
  } catch (error) {
    console.error('Error decoding hex string:', error);
    return 'Unknown';
  }
}

export async function POST(request: Request) {
  try {
    const body: AlchemyRequest = await request.json();
    const { address, action, page = 1, limit = 5, filter = 'all', fromBlock, toBlock } = body;

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
        // Get token balances using JSON-RPC for Base
        console.log(`Fetching tokens for address: ${address}`);
        
        // First, get the latest block number for token discovery
        const tokenBlockRequest = {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1
        };

        const tokenBlockResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokenBlockRequest),
        });

        if (!tokenBlockResp.ok) {
          throw new Error(`Failed to get block number: ${tokenBlockResp.status}`);
        }

        const tokenBlockData = await tokenBlockResp.json();
        const tokenLatestBlock = parseInt(tokenBlockData.result, 16);
        const tokenFromBlock = Math.max(0, tokenLatestBlock - 10000); // Get last 10,000 blocks for better coverage

        // Get all Transfer events involving this address
        const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
        
        const tokenLogsRequest = {
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [{
            fromBlock: `0x${tokenFromBlock.toString(16)}`,
            toBlock: "latest",
            topics: [
              transferEventSignature,
              null, // from address
              `0x000000000000000000000000${address.slice(2)}` // to address (our wallet)
            ]
          }],
          id: 2
        };

        const tokenLogsResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokenLogsRequest),
        });

        if (!tokenLogsResp.ok) {
          throw new Error(`Failed to get transfer logs: ${tokenLogsResp.status}`);
        }

        const tokenLogsData = await tokenLogsResp.json();
        
        // Extract unique token addresses from Transfer events
        const tokenAddresses = new Set<string>();
        if (tokenLogsData.result) {
          tokenLogsData.result.forEach((log: LogEntry) => {
            if (log.address) {
              tokenAddresses.add(log.address.toLowerCase());
            }
          });
        }

        // Also check for common tokens that might not have recent transfers
        const commonTokens = [
          { address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
          { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
          { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', name: 'Dai', symbol: 'DAI', decimals: 18 },
          { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', name: 'Coinbase Wrapped Staked ETH', symbol: 'cbETH', decimals: 18 },
        ];

        commonTokens.forEach(token => {
          tokenAddresses.add(token.address.toLowerCase());
        });

        const tokenBalances = [];
        const processedAddresses = new Set<string>();

        // Process each unique token address
        for (const tokenAddress of tokenAddresses) {
          if (processedAddresses.has(tokenAddress)) continue;
          processedAddresses.add(tokenAddress);

          try {
            // Get token metadata (name, symbol, decimals)
            const metadataCalls = [
              {
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                  to: tokenAddress,
                  data: "0x06fdde03" // name()
                }, "latest"],
                id: 1
              },
              {
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                  to: tokenAddress,
                  data: "0x95d89b41" // symbol()
                }, "latest"],
                id: 2
              },
              {
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                  to: tokenAddress,
                  data: "0x313ce567" // decimals()
                }, "latest"],
                id: 3
              },
              {
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                  to: tokenAddress,
                  data: `0x70a08231000000000000000000000000${address.slice(2)}` // balanceOf(address)
                }, "latest"],
                id: 4
              }
            ];

            const metadataResp = await fetch(alchemyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(metadataCalls),
            });

            if (metadataResp.ok) {
              const metadataData = await metadataResp.json();
              
              if (metadataData.length === 4) {
                const nameResult = metadataData[0]?.result;
                const symbolResult = metadataData[1]?.result;
                const decimalsResult = metadataData[2]?.result;
                const balanceResult = metadataData[3]?.result;

                if (balanceResult && balanceResult !== '0x') {
                  const balance = parseInt(balanceResult, 16);
                  if (balance > 0) {
                    // Decode name and symbol from hex
                    const name = nameResult ? decodeHexString(nameResult) : 'Unknown Token';
                    const symbol = symbolResult ? decodeHexString(symbolResult) : 'UNK';
                    const decimals = decimalsResult ? parseInt(decimalsResult, 16) : 18;
                    
                    const tokenBalance = balance / Math.pow(10, decimals);
                    
                    tokenBalances.push({
                      contractAddress: tokenAddress,
                      name: name,
                      symbol: symbol,
                      tokenBalance: tokenBalance.toString(),
                      decimals: decimals.toString(),
                      logo: null
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.log(`Error fetching metadata for token ${tokenAddress}:`, error);
          }
        }

        result = {
          tokenBalances
        };
        console.log(`Token result:`, result);
        break;

      case 'transactions':
        // Get transaction history using proper JSON-RPC methods
        console.log(`Fetching transactions for address: ${address}`);
        
        // First get the latest block number
        const blockRequest = {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1
        };

        const blockResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(blockRequest),
        });

        if (!blockResp.ok) {
          throw new Error(`Failed to get block number: ${blockResp.status}`);
        }

        const blockData = await blockResp.json();
        const latestBlock = parseInt(blockData.result, 16);
        const searchFromBlock = fromBlock || Math.max(0, latestBlock - 10000); // Get last 10,000 blocks by default
        const searchToBlock = toBlock || latestBlock;

        // Get transaction logs for the address (both as sender and receiver)
        const logsRequest = {
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [{
            fromBlock: `0x${searchFromBlock.toString(16)}`,
            toBlock: `0x${searchToBlock.toString(16)}`,
            address: address // This will get ALL logs involving this address
          }],
          id: 2
        };

        // Also get direct transactions involving this address
        const directTxRequest = {
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [{
            fromBlock: `0x${searchFromBlock.toString(16)}`,
            toBlock: `0x${searchToBlock.toString(16)}`,
            topics: [
              null, // any event signature
              `0x000000000000000000000000${address.slice(2)}`, // from address
              null // any to address
            ]
          }],
          id: 3
        };

        const directTxRequest2 = {
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [{
            fromBlock: `0x${searchFromBlock.toString(16)}`,
            toBlock: `0x${searchToBlock.toString(16)}`,
            topics: [
              null, // any event signature
              null, // any from address
              `0x000000000000000000000000${address.slice(2)}` // to address
            ]
          }],
          id: 4
        };

        // Make all requests in parallel
        const [txResp, directTxResp, directTxResp2] = await Promise.all([
          fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logsRequest),
          }),
          fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(directTxRequest),
          }),
          fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(directTxRequest2),
          })
        ]);

        console.log(`Transaction response status: ${txResp.status}`);
        if (!txResp.ok) {
          const errorText = await txResp.text();
          console.log(`Transaction error response: ${errorText}`);
          throw new Error(`Alchemy API error: ${txResp.status} - ${errorText}`);
        }

        const logsData = await txResp.json();
        const directTxData = await directTxResp.json();
        const directTxData2 = await directTxResp2.json();
        
        // Combine all transaction hashes from different sources
        const allTransactionHashes = new Set<string>();
        
        // Add hashes from general logs
        if (logsData.result && logsData.result.length > 0) {
          logsData.result.forEach((log: LogEntry) => {
            if (log.transactionHash) {
              allTransactionHashes.add(log.transactionHash);
            }
          });
        }
        
        // Add hashes from direct transactions (from)
        if (directTxData.result && directTxData.result.length > 0) {
          directTxData.result.forEach((log: LogEntry) => {
            if (log.transactionHash) {
              allTransactionHashes.add(log.transactionHash);
            }
          });
        }
        
        // Add hashes from direct transactions (to)
        if (directTxData2.result && directTxData2.result.length > 0) {
          directTxData2.result.forEach((log: LogEntry) => {
            if (log.transactionHash) {
              allTransactionHashes.add(log.transactionHash);
            }
          });
        }
        
        console.log(`Found ${allTransactionHashes.size} unique transaction hashes`);
        
        // Get all transaction details using eth_getTransactionByHash and eth_getTransactionReceipt
        const allTxs: Transaction[] = [];
        const uniqueHashes = Array.from(allTransactionHashes);
        
        // Get all transaction details and receipts in parallel (batch of 10)
        const batchSize = 10;
        for (let i = 0; i < uniqueHashes.length; i += batchSize) {
          const batch = uniqueHashes.slice(i, i + batchSize);
          const batchRequests = batch.map((txHash, index) => [
            {
              jsonrpc: "2.0",
              method: "eth_getTransactionByHash",
              params: [txHash],
              id: 5 + i * 2 + index * 2
            },
            {
              jsonrpc: "2.0",
              method: "eth_getTransactionReceipt",
              params: [txHash],
              id: 5 + i * 2 + index * 2 + 1
            }
          ]).flat();

          const batchResp = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batchRequests),
          });

          if (batchResp.ok) {
            const batchData = await batchResp.json();
            const txDetails: Transaction[] = [];
            const txReceipts: { transactionHash: string; status: string; gasUsed: string; effectiveGasPrice: string; blockNumber: string }[] = [];
            
            batchData.forEach((response: { result?: Transaction | { transactionHash: string; status: string; gasUsed: string; effectiveGasPrice: string; blockNumber: string } }) => {
              if (response.result) {
                if ('hash' in response.result) {
                  txDetails.push(response.result as Transaction);
                } else {
                  txReceipts.push(response.result as { transactionHash: string; status: string; gasUsed: string; effectiveGasPrice: string; blockNumber: string });
                }
              }
            });
            
                         // Merge transaction details with receipts
             txDetails.forEach((tx: Transaction) => {
               const receipt = txReceipts.find((r) => r.transactionHash === tx.hash);
               if (receipt) {
                 allTxs.push({
                   ...tx,
                   status: receipt.status,
                   gasUsed: receipt.gasUsed,
                   effectiveGasPrice: receipt.effectiveGasPrice,
                   blockNumber: receipt.blockNumber
                 });
               } else {
                 allTxs.push(tx);
               }
             });
          }
        }

                 // Get block timestamps for all unique block numbers
         const uniqueBlockNumbers = [...new Set(allTxs.map((tx: Transaction) => tx.blockNumber).filter(Boolean))];
         const blockTimestamps: { [key: string]: number } = {};
         
         // Get timestamps for all blocks in batches
         const blockBatchSize = 10;
         for (let i = 0; i < uniqueBlockNumbers.length; i += blockBatchSize) {
           const batch = uniqueBlockNumbers.slice(i, i + blockBatchSize);
           const batchRequests = batch.map((blockNumber, index) => ({
             jsonrpc: "2.0",
             method: "eth_getBlockByNumber",
             params: [blockNumber, false],
             id: 1000 + i + index
           }));

           const blockBatchResp = await fetch(alchemyUrl, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify(batchRequests),
           });

           if (blockBatchResp.ok) {
             const blockBatchData = await blockBatchResp.json();
             blockBatchData.forEach((response: { result?: { number: string; timestamp: string } }) => {
               if (response.result && response.result.timestamp) {
                 const blockNumber = response.result.number;
                 const timestamp = parseInt(response.result.timestamp, 16);
                 blockTimestamps[blockNumber] = timestamp;
               }
             });
           }
         }

         // Add timestamps to transactions
         allTxs.forEach((tx: Transaction) => {
           if (tx.blockNumber && blockTimestamps[tx.blockNumber]) {
             (tx as Transaction & { timestamp?: number }).timestamp = blockTimestamps[tx.blockNumber];
           }
         });

         // Get token names for transaction addresses
         const uniqueAddresses = new Set<string>();
         allTxs.forEach((tx: Transaction) => {
           if (tx.to) uniqueAddresses.add(tx.to.toLowerCase());
           if (tx.from) uniqueAddresses.add(tx.from.toLowerCase());
         });

         const addressNames: { [key: string]: string } = {};
         
         // Get token names for addresses in batches
         const addressBatchSize = 5;
         const addressArray = Array.from(uniqueAddresses);
         for (let i = 0; i < addressArray.length; i += addressBatchSize) {
           const batch = addressArray.slice(i, i + addressBatchSize);
           const batchRequests = batch.map((address, index) => [
             {
               jsonrpc: "2.0",
               method: "eth_call",
               params: [{
                 to: address,
                 data: "0x06fdde03" // name()
               }, "latest"],
               id: 2000 + i * 2 + index * 2
             },
             {
               jsonrpc: "2.0",
               method: "eth_call",
               params: [{
                 to: address,
                 data: "0x95d89b41" // symbol()
               }, "latest"],
               id: 2000 + i * 2 + index * 2 + 1
             }
           ]).flat();

           const addressBatchResp = await fetch(alchemyUrl, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify(batchRequests),
           });

           if (addressBatchResp.ok) {
             const addressBatchData = await addressBatchResp.json();
             batch.forEach((address, index) => {
               const nameResult = addressBatchData[index * 2]?.result;
               const symbolResult = addressBatchData[index * 2 + 1]?.result;
               
               if (nameResult && nameResult !== '0x') {
                 const name = decodeHexString(nameResult);
                 const symbol = symbolResult && symbolResult !== '0x' ? decodeHexString(symbolResult) : '';
                 addressNames[address] = name || symbol || 'Unknown Token';
               }
             });
           }
         }

         // Add token names to transactions
         allTxs.forEach((tx: Transaction) => {
           if (tx.to && addressNames[tx.to.toLowerCase()]) {
             tx.toName = addressNames[tx.to.toLowerCase()];
           }
           if (tx.from && addressNames[tx.from.toLowerCase()]) {
             tx.fromName = addressNames[tx.from.toLowerCase()];
           }
         });

                  // Apply filtering based on filter parameter
         let filteredTxs = allTxs;
         if (filter === 'token_transfers') {
           // Filter transactions with token transfer input data
           filteredTxs = allTxs.filter((tx: Transaction) => 
             tx.input && tx.input !== '0x' && 
             (tx.input.startsWith('0xa9059cbb') || // transfer
              tx.input.startsWith('0x23b872dd') || // transferFrom
              tx.input.startsWith('0x40c10f19') || // mint
              tx.input.startsWith('0x42966c68'))    // burn
           );
         } else if (filter === 'internal') {
           // Internal transactions (contract calls with value)
           filteredTxs = allTxs.filter((tx: Transaction) => 
             tx.to && tx.input && tx.input !== '0x' && 
             tx.value && parseInt(tx.value, 16) > 0
           );
         }

        // Sort by block number (newest first)
        filteredTxs.sort((a: Transaction, b: Transaction) => {
          const blockA = parseInt(a.blockNumber || '0', 16);
          const blockB = parseInt(b.blockNumber || '0', 16);
          return blockB - blockA;
        });

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
        console.log(`Transaction result:`, result);
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
      error: 'Failed to fetch wallet data' 
    }, { status: 500 });
  }
}
