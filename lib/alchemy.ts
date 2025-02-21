const fetchBaseData = async () => {
    try {
      if (!ALCHEMY_API_URL) {
        console.error('Missing Alchemy API URL.');
        return;
      }
  
      const response = await fetch(`${ALCHEMY_API_URL}/v2/blockNumber`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  
      const blockData = await response.json();
      console.log('Block Data:', blockData); // Debugging
  
      const latestBlock = parseInt(blockData.result, 16); // Convert hex to number
  
      setStats((prev) => ({ ...prev, latestBlock }));
    } catch (error) {
      console.error('Error fetching Base chain data:', error);
    }
  };
  
