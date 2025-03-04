export async function fetchCoinData(coinAddress: string) {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinAddress}&vs_currencies=usd&include_24hr_change=true`
      );
      if (!response.ok) throw new Error("Failed to fetch coin data");
  
      return await response.json();
    } catch (error) {
      console.error("Error fetching CoinGecko data:", error);
      return null;
    }
  }
  