import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const tokenAddress = searchParams.get('tokenAddress');
    const dataType = searchParams.get('type'); // 'orders' or 'positions'

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user's trading transactions
    let transactionsQuery = db.collection('wallet_transactions')
      .where('walletAddress', '==', walletAddress)
      .where('type', '==', 'swap')
      .orderBy('timestamp', 'desc')
      .limit(100);

    // Filter by specific token if provided
    if (tokenAddress) {
      transactionsQuery = transactionsQuery.where('outputToken', '==', tokenAddress);
    }

    const transactionsSnapshot = await transactionsQuery.get();
    
    if (transactionsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        orders: [],
        positions: []
      });
    }

         const transactions = transactionsSnapshot.docs.map(doc => ({
       id: doc.id,
       ...doc.data(),
       timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
     })) as any[];

    // Process orders (all transactions)
    const orders = transactions.map((tx: any) => ({
      id: tx.id,
      type: tx.inputToken === 'ETH' ? 'buy' : 'sell',
      amount: tx.outputAmount || tx.inputAmount,
      price: tx.outputValue / parseFloat(tx.outputAmount || tx.inputAmount),
      status: tx.status || 'completed',
      timestamp: new Date(tx.timestamp).getTime(),
      tokenSymbol: tx.outputTokenSymbol || 'TOKEN',
      tokenAddress: tx.outputToken
    }));

         // Calculate positions (only buy transactions that haven't been fully sold)
     const buyTransactions = transactions.filter((tx: any) => tx.inputToken === 'ETH');
     const sellTransactions = transactions.filter((tx: any) => tx.outputToken === 'ETH');
     
     // Get unique token addresses to fetch current prices
     const uniqueTokenAddresses = [...new Set(buyTransactions.map(tx => tx.outputToken))];
     
     // Fetch current prices from DexScreener
     const currentPrices: { [key: string]: number } = {};
     for (const tokenAddr of uniqueTokenAddresses) {
       try {
         const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddr}`);
         if (dexScreenerResponse.ok) {
           const dexData = await dexScreenerResponse.json();
           const pair = dexData.pairs?.[0];
           if (pair?.priceUsd) {
             currentPrices[tokenAddr] = parseFloat(pair.priceUsd);
           }
         }
       } catch (error) {
         console.error(`Error fetching price for ${tokenAddr}:`, error);
         currentPrices[tokenAddr] = 0;
       }
     }
     
     // Create a map to store token symbols for positions
     const tokenSymbols: { [key: string]: string } = {};
     
     // Fetch token symbols for positions that don't have them
     const tokensNeedingSymbols = buyTransactions
       .filter((buyTx: any) => !buyTx.outputTokenSymbol && buyTx.outputToken)
       .map((buyTx: any) => buyTx.outputToken);
     
     const uniqueTokensNeedingSymbols = [...new Set(tokensNeedingSymbols)];
     
     // Fetch symbols in parallel
     await Promise.all(uniqueTokensNeedingSymbols.map(async (tokenAddress) => {
       try {
         const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
         if (dexScreenerResponse.ok) {
           const dexData = await dexScreenerResponse.json();
           const pair = dexData.pairs?.[0];
           if (pair?.baseToken?.symbol) {
             tokenSymbols[tokenAddress] = pair.baseToken.symbol;
           }
         }
       } catch (error) {
         console.error(`Error fetching token symbol for ${tokenAddress}:`, error);
       }
     }));
     
     const positions = buyTransactions.map((buyTx: any) => {
       const tokenAddress = buyTx.outputToken;
       const buyAmount = parseFloat(buyTx.outputAmount);
       const buyValue = buyTx.outputValue;
       
       // Find corresponding sell transactions for this token
       const sellsForToken = sellTransactions.filter((sellTx: any) => 
         sellTx.inputToken === tokenAddress
       );
       
       const totalSold = sellsForToken.reduce((sum: number, sellTx: any) => 
         sum + parseFloat(sellTx.inputAmount), 0
       );
       
       const remainingAmount = buyAmount - totalSold;
       
       if (remainingAmount <= 0) return null;
       
       const avgPrice = buyValue / buyAmount;
       const currentPrice = currentPrices[tokenAddress] || 0;
       
       // Get token symbol from transaction data or fetched symbols
       const tokenSymbol = buyTx.outputTokenSymbol || tokenSymbols[tokenAddress] || 'TOKEN';
       
       // Calculate P&L only if we have a current price
       if (currentPrice > 0) {
         const pnlPercentage = ((currentPrice - avgPrice) / avgPrice) * 100;
         const pnlValue = remainingAmount * (currentPrice - avgPrice);
         
         return {
           id: buyTx.id,
           tokenSymbol: tokenSymbol,
           tokenAddress: tokenAddress,
           amount: remainingAmount.toString(),
           avgPrice: avgPrice.toFixed(6),
           currentPrice: currentPrice.toFixed(6),
           pnl: `${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%`,
           pnlValue: `${pnlValue >= 0 ? '+' : ''}$${Math.abs(pnlValue).toFixed(2)}`
         };
       } else {
         // Return position without P&L if no current price available
         return {
           id: buyTx.id,
           tokenSymbol: tokenSymbol,
           tokenAddress: tokenAddress,
           amount: remainingAmount.toString(),
           avgPrice: avgPrice.toFixed(6),
           currentPrice: 'N/A',
           pnl: 'N/A',
           pnlValue: 'N/A'
         };
       }
     }).filter(Boolean);

    return NextResponse.json({
      success: true,
      orders: dataType === 'orders' ? orders : [],
      positions: dataType === 'positions' ? positions : [],
      allOrders: orders,
      allPositions: positions
    });

  } catch (error) {
    console.error('Error fetching trading data:', error);
    return NextResponse.json({ error: 'Failed to fetch trading data' }, { status: 500 });
  }
}
