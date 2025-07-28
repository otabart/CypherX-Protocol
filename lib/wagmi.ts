import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { metaMask, coinbaseWallet, injected, walletConnect } from "@wagmi/connectors";

// Configure the Base chain as the first element in the array
const chains = [base] as const;

// Configure connectors
const connectors = [
  metaMask({ dappMetadata: { name: "CypherX" } }),
  coinbaseWallet({ appName: "CypherX" }),
  injected(),
  walletConnect({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your_project_id",
    metadata: {
      name: "CypherX",
      description: "CypherX Trading Platform on Base",
      url: "https://cypherx.com",
      icons: ["https://cypherx.com/icon.png"],
    },
  }),
];

// Create the wagmi config
export const config = createConfig({
  chains,
  connectors,
  transports: {
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/your_alchemy_api_key`),
  },
});