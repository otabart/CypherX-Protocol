import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { 
  metaMask, 
  coinbaseWallet, 
  injected, 
  walletConnect,
  safe
} from "@wagmi/connectors";

// Configure the Base chain as the first element in the array
const chains = [base] as const;

// Configure connectors
const connectors = [
  metaMask({ dappMetadata: { name: "Homebase" } }),
  coinbaseWallet({ 
    appName: "Homebase",
    appLogoUrl: "https://homebase.com/icon.png",
  }),
  injected({
    target: "phantom",
    shimDisconnect: true,
  }),
  injected({
    target: "coinbaseWallet",
    shimDisconnect: true,
  }),
  injected({
    target: "braveWallet",
    shimDisconnect: true,
  }),
  injected({
    target: "exodus",
    shimDisconnect: true,
  }),
  injected(),
  walletConnect({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your_project_id",
    metadata: {
      name: "Homebase",
      description: "Homebase Trading Platform on Base",
      url: "https://homebase.com",
      icons: ["https://homebase.com/icon.png"],
    },
  }),
  safe(),
];

// Create the wagmi config
export const config = createConfig({
  chains,
  connectors,
  transports: {
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/your_alchemy_api_key`),
  },
});