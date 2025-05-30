import { db } from "lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface TokenData {
  poolAddress: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const fetchTokenData = async (poolAddress: string): Promise<TokenData | null> => {
  try {
    const tokensRef = collection(db, "tokens");
    const q = query(tokensRef, where("poolAddress", "==", poolAddress));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`No token found for poolAddress: ${poolAddress}`);
      return null;
    }

    const tokenDoc = querySnapshot.docs[0].data();
    return {
      poolAddress,
      tokenAddress: tokenDoc.address,
      symbol: tokenDoc.symbol,
      name: tokenDoc.name,
      decimals: tokenDoc.decimals || 18,
    };
  } catch (error) {
    console.error("Error fetching token data:", error);
    return null;
  }
};