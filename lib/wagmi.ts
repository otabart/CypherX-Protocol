// lib/wagmi.ts
import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { metaMask } from "@wagmi/connectors";

// Configure the Base chain
const chains = [base];

// Configure connectors (e.g., MetaMask)
const connectors = [
  metaMask({
    dappMetadata: {
      name: "Token Scanner",
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