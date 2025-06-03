// lib/wagmi.ts
import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { metaMask, coinbaseWallet, injected, walletConnect } from "@wagmi/connectors";

// Configure the Base chain
const chains = [base];

// Configure connectors
const connectors = [
  metaMask({
    dappMetadata: {
      name: "Token Scanner",
    },
  }),
  coinbaseWallet({
    appName: "Token Scanner",
  }),
  injected({
    target: "phantom", // Specifically target Phantom wallet
  }),
  walletConnect({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your_project_id", // Replace with your WalletConnect project ID
    metadata: {
      name: "Token Scanner",
      description: "Token Scanner App",
      url: "https://your-app-url.com",
      icons: ["https://your-app-url.com/icon.png"],
    },
  }),
];

// Create the wagmi config
export const config = createConfig({
  chains,
  connectors,
  transports: {
    [base.id]: http("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN"), // Replace with your Alchemy API key
  },
});