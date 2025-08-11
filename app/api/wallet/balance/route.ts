import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const tokenAddress = searchParams.get('tokenAddress');
    
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Use Alchemy RPC for reliable access
    const rpcUrl = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    try {
      // Get ETH balance
      const ethBalance = await provider.getBalance(address);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);

      let tokenBalance = "0.0";
      
      // Get token balance if token address is provided
      if (tokenAddress) {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const balance = await tokenContract.balanceOf(address);
          const decimals = await tokenContract.decimals();
          tokenBalance = ethers.formatUnits(balance, decimals);
        } catch (tokenError) {
          console.error('Error fetching token balance:', tokenError);
          tokenBalance = "0.0";
        }
      }
      
      console.log(`✅ Balance for ${address}: ${ethBalanceFormatted} ETH, ${tokenBalance} tokens`);
      
      return NextResponse.json({
        success: true,
        ethBalance: ethBalanceFormatted,
        tokenBalance: tokenBalance,
        address: address
      });
    } catch (error) {
      console.error('Error fetching balance:', error);
      return NextResponse.json(
        { error: 'Failed to fetch balance' }, 
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in balance API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
