const { Alchemy, Network } = require('alchemy-sdk'); // Fix this line

// Alchemy configuration
const config = {
  apiKey: '8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN', // Replace with your actual API key
  network: Network.BASE_MAINNET, // Use Base Mainnet
};

const alchemy = new Alchemy(config);

async function getLatestBlock() {
  try {
    const latestBlock = await alchemy.core.getBlockNumber();
    console.log('The latest block number is:', latestBlock);
  } catch (error) {
    console.error('Error fetching the latest block:', error);
  }
}

getLatestBlock();


