import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface Order {
  id: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  price: string;
  value: number;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  transactionHash: string;
}

interface OrdersResponse {
  orders: Order[];
  totalOrders: number;
  buyOrders: number;
  sellOrders: number;
  completedOrders: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const tokenAddress = searchParams.get("tokenAddress");
    const type = searchParams.get("type"); // 'buy', 'sell', or 'all'
    
    if (!address) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }
    
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
              // 🔧 IMPROVED: Get all transactions first, then filter in memory for better sell order support
     let transactionsQuery = db.collection("wallet_transactions")
       .where("walletAddress", "==", address)
       .where("type", "==", "swap")
       .orderBy("timestamp", "desc");
     
     const transactionsSnapshot = await transactionsQuery.get();
     
     // 🔧 NEW: Filter transactions in memory to properly handle both buy and sell orders
     let filteredDocs = transactionsSnapshot.docs;
     if (tokenAddress) {
       filteredDocs = transactionsSnapshot.docs.filter(doc => {
         const data = doc.data();
         // Include if it's a buy order for this token (outputToken) OR a sell order for this token (inputToken)
         return data.outputToken === tokenAddress || data.inputToken === tokenAddress;
       });
     }
    
         if (filteredDocs.length === 0) {
       return NextResponse.json({
         orders: [],
         totalOrders: 0,
         buyOrders: 0,
         sellOrders: 0,
         completedOrders: 0
       });
     }
     
     // Convert transactions to orders format
     const orders: Order[] = filteredDocs.map(doc => {
      const data = doc.data();
      const isBuy = data.inputToken === "ETH";
      
      // Determine token address and symbol
      const tokenAddr = isBuy ? data.outputToken : data.inputToken;
      const tokenSymbol = tokenAddr === "0x0000000000000000000000000000000000000000" ? "ETH" : 
                         tokenAddr.slice(0, 6) + "...";
      
      // Calculate price
      const amount = parseFloat(isBuy ? data.outputAmount : data.inputAmount);
      const value = isBuy ? data.inputValue : data.outputValue;
      const price = amount > 0 ? value / amount : 0;
      
      return {
        id: doc.id,
        type: isBuy ? "buy" : "sell",
        tokenAddress: tokenAddr,
        tokenSymbol,
        amount: isBuy ? data.outputAmount : data.inputAmount,
        price: price.toString(),
        value: value,
        timestamp: data.timestamp.toDate().getTime(),
        status: 'completed', // All stored transactions are completed
        transactionHash: data.transactionHash
      };
    });
    
    // Filter by type if specified
    let filteredOrders = orders;
    if (type && type !== 'all') {
      filteredOrders = orders.filter(order => order.type === type);
    }
    
    // Calculate statistics
    const totalOrders = filteredOrders.length;
    const buyOrders = filteredOrders.filter(order => order.type === 'buy').length;
    const sellOrders = filteredOrders.filter(order => order.type === 'sell').length;
    const completedOrders = filteredOrders.filter(order => order.status === 'completed').length;
    
    const response: OrdersResponse = {
      orders: filteredOrders,
      totalOrders,
      buyOrders,
      sellOrders,
      completedOrders
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
