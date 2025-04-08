"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet, base } from "@reown/appkit/networks";
import { ethers } from "ethers";
import { calculateROI, calculateDynamicPrizePool } from "./lib/competitionLogic.tsx"; // Explicit .tsx

const TRADING_COMPETITION_ABI = [
  "function joinCompetition(uint256 competitionId) public",
  "function getJoinedCompetitions(address user) public view returns (uint256[])",
  "function getParticipantBalance(address participant, uint256 competitionId) public view returns (uint256)",
  "function getStartingBalance(address participant, uint256 competitionId) public view returns (uint256)",
  "function getParticipantCount(uint256 competitionId) public view returns (uint256)",
  "function basePrizePool() public view returns (uint256)",
  "function contributionPerParticipant() public view returns (uint256)",
];
const TRADING_COMPETITION_ADDRESS = "0xYourContractAddressHere";

type CompetitionData = {
  roi: number;
  prizePool: number;
  participantCount: number;
};

type CompetitionContextType = {
  connectedWallet: string;
  displayName: string;
  joinedCompetitions: string[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  joinCompetition: (competitionId: string) => Promise<void>;
  login: (name: string) => void;
  isAppKitLoading: boolean;
  isConnecting: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  getCompetitionData: (competitionId: string) => Promise<CompetitionData>;
};

const CompetitionContext = createContext<CompetitionContextType | null>(null);

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [connectedWallet, setConnectedWallet] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("connectedWallet") || "" : ""
  );
  const [displayName, setDisplayName] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("displayName") || "" : ""
  );
  const [joinedCompetitions, setJoinedCompetitions] = useState<string[]>([]);
  const [appKit, setAppKit] = useState<any>(null);
  const [isAppKitLoading, setIsAppKitLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  useEffect(() => {
    const envProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
    console.log(">>> Project ID from .env:", envProjectId);

    const projectId = envProjectId || "636b28a2b49e1275454d2c836f3c0c11";
    console.log(">>> Using project ID (env or fallback):", projectId);

    if (!projectId) {
      console.error("Project ID is missing, cannot initialize AppKit.");
      setIsAppKitLoading(false);
      return;
    }

    const metadata = {
      name: "My Trading DApp",
      url: "http://localhost:3000",
      description: "A Trading Competition dApp powered by Reown AppKit",
      icons: ["https://example.com/favicon.ico"],
    };

    try {
      const kit = createAppKit({
        projectId,
        networks: [mainnet, base],
        metadata,
        defaultNetwork: base,
        adapters: [new EthersAdapter()],
        features: {
          allWallets: false,
          email: false,
          socials: false,
          analytics: false,
        },
        enableDefaultButton: false,
        showWallets: false,
      });
      console.log(">>> Created kit:", kit);
      setAppKit(kit);
      console.log("AppKit initialized successfully.");

      kit.subscribeEvents((event: any) => {
        console.log("AppKit event:", event);
        if (event.name === "ACCOUNT_CHANGED" && event.data?.address) {
          console.log("Account changed:", event.data.address);
          setConnectedWallet(event.data.address);
          localStorage.setItem("connectedWallet", event.data.address);
          updateProviderAndSigner(kit);
        } else if (event.name === "ACCOUNT_DISCONNECTED") {
          console.log("Account disconnected");
          setConnectedWallet("");
          setProvider(null);
          setSigner(null);
          localStorage.removeItem("connectedWallet");
        }
      });

      const account = kit.getAccount?.();
      if (account && account.address) {
        console.log("Existing wallet address on mount:", account.address);
        setConnectedWallet(account.address);
        localStorage.setItem("connectedWallet", account.address);
        updateProviderAndSigner(kit);
      }
    } catch (err) {
      console.error("Error creating AppKit:", err);
    } finally {
      setIsAppKitLoading(false);
    }
  }, []);

  async function updateProviderAndSigner(kit: any) {
    const web3Provider = kit.getProvider();
    if (web3Provider) {
      const providerInstance = new ethers.BrowserProvider(web3Provider);
      setProvider(providerInstance);
      const signerInstance = await providerInstance.getSigner();
      setSigner(signerInstance);
      await switchToBaseChain(providerInstance);
      await fetchJoinedCompetitions(signerInstance.address);
    }
  }

  async function connectWallet() {
    if (!appKit) {
      console.error("AppKit not initialized yet.");
      return;
    }
    try {
      setIsConnecting(true);
      console.log("Opening wallet modal...");
      await appKit.open();
      console.log("Wallet modal opened.");

      const account = appKit.getAccount?.();
      if (account?.address) {
        console.log("Connected wallet address:", account.address);
        setConnectedWallet(account.address);
        localStorage.setItem("connectedWallet", account.address);
        await updateProviderAndSigner(appKit);
      } else {
        console.log("Waiting for wallet connection via event...");
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
    } finally {
      setIsConnecting(false);
    }
  }

  async function switchToBaseChain(provider: ethers.BrowserProvider) {
    const baseChainId = "0x2105"; // Base chain ID (8453 in hex)
    try {
      const currentChainId = await provider.send("eth_chainId", []);
      console.log("Current chain ID:", currentChainId);

      if (currentChainId !== baseChainId) {
        console.log("Switching to Base chain...");
        await provider.send("wallet_switchEthereumChain", [{ chainId: baseChainId }]);
        console.log("Successfully switched to Base chain.");
      } else {
        console.log("Already on Base chain.");
      }
    } catch (error: any) {
      if (error.code === 4902 || error.code === -32603) {
        console.log("Adding Base chain to wallet...");
        await provider.send("wallet_addEthereumChain", [
          {
            chainId: baseChainId,
            chainName: "Base",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"],
          },
        ]);
        console.log("Base chain added, switching...");
        await provider.send("wallet_switchEthereumChain", [{ chainId: baseChainId }]);
        console.log("Successfully switched to Base chain after adding.");
      } else {
        throw error;
      }
    }
  }

  function disconnectWallet() {
    setConnectedWallet("");
    setProvider(null);
    setSigner(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("connectedWallet");
    }
    if (appKit) {
      appKit.disconnect();
      console.log("Disconnected wallet via AppKit.");
    }
  }

  async function joinCompetition(competitionId: string) {
    if (!signer) {
      console.error("No signer available. Please connect wallet first.");
      return;
    }
    if (!joinedCompetitions.includes(competitionId)) {
      try {
        const contract = new ethers.Contract(
          TRADING_COMPETITION_ADDRESS,
          TRADING_COMPETITION_ABI,
          signer
        );
        const tx = await contract.joinCompetition(ethers.toBigInt(competitionId));
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("Joined competition:", competitionId);
        setJoinedCompetitions([...joinedCompetitions, competitionId]);
      } catch (error) {
        console.error("Error joining competition:", error);
      }
    }
  }

  async function fetchJoinedCompetitions(userAddress: string) {
    if (!provider) return;
    try {
      const contract = new ethers.Contract(
        TRADING_COMPETITION_ADDRESS,
        TRADING_COMPETITION_ABI,
        provider
      );
      const competitions = await contract.getJoinedCompetitions(userAddress);
      setJoinedCompetitions(competitions.map((id: bigint) => id.toString()));
    } catch (error) {
      console.error("Error fetching joined competitions:", error);
    }
  }

  async function getCompetitionData(competitionId: string): Promise<CompetitionData> {
    if (!provider || !connectedWallet) {
      throw new Error("Wallet not connected or provider unavailable");
    }
    try {
      const contract = new ethers.Contract(
        TRADING_COMPETITION_ADDRESS,
        TRADING_COMPETITION_ABI,
        provider
      );

      const startBalance = Number(
        ethers.formatEther(await contract.getStartingBalance(connectedWallet, competitionId))
      );
      const endBalance = Number(
        ethers.formatEther(await contract.getParticipantBalance(connectedWallet, competitionId))
      );
      const participantCount = Number(await contract.getParticipantCount(competitionId));
      const basePrizePool = Number(ethers.formatEther(await contract.basePrizePool()));
      const contributionPerParticipant = Number(
        ethers.formatEther(await contract.contributionPerParticipant())
      );

      const roi = calculateROI(startBalance, endBalance);
      const prizePool = calculateDynamicPrizePool(
        basePrizePool,
        contributionPerParticipant,
        participantCount
      );

      return {
        roi,
        prizePool,
        participantCount,
      };
    } catch (error) {
      console.error("Error fetching competition data:", error);
      return { roi: 0, prizePool: 0, participantCount: 0 };
    }
  }

  function login(name: string) {
    setDisplayName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("displayName", name);
    }
  }

  return (
    <CompetitionContext.Provider
      value={{
        connectedWallet,
        displayName,
        joinedCompetitions,
        connectWallet,
        disconnectWallet,
        joinCompetition,
        login,
        isAppKitLoading,
        isConnecting,
        provider,
        signer,
        getCompetitionData,
      }}
    >
      {children}
    </CompetitionContext.Provider>
  );
}

export function useCompetitionContext() {
  const ctx = useContext(CompetitionContext);
  if (!ctx) {
    throw new Error("useCompetitionContext must be used within CompetitionProvider");
  }
  return ctx;
}