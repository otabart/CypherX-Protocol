// app/TradingCompetition/CompetitionContext.tsx
"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet } from "@reown/appkit/networks";
import { ethers } from "ethers";

type CompetitionContextType = {
  connectedWallet: string;
  displayName: string;
  joinedCompetitions: string[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  joinCompetition: (competitionId: string) => void;
  login: (name: string) => void;
};

const CompetitionContext = createContext<CompetitionContextType | null>(null);

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [connectedWallet, setConnectedWallet] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinedCompetitions, setJoinedCompetitions] = useState<string[]>([]);
  const [appKit, setAppKit] = useState<any>(null);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "DUMMY_PROJECT_ID";
    const metadata = {
      name: "My Trading DApp",
      url: "http://localhost:3000",
      description: "A Trading Competition dApp powered by Reown AppKit",
    };

    if (projectId === "DUMMY_PROJECT_ID") {
      console.warn("Using dummy project id. Creating dummy kit to prevent errors.");
      const dummyKit = {
        open: async () => {
          console.warn("Dummy kit open called. No real wallet connection available.");
        },
        modal: {
          subscribeProvider: async (fn: any) => {
            console.warn("Dummy subscribeProvider called. Returning dummy provider.");
            return { request: async () => {} };
          },
        },
      };
      setAppKit(dummyKit);
      return;
    }

    try {
      const kit = createAppKit({
        adapter: new EthersAdapter({
          chain: mainnet,
          projectId,
        }),
        metadata,
      });
      kit.init();
      setAppKit(kit);
    } catch (err) {
      console.error("Error initializing AppKit:", err);
    }
  }, []);

  async function connectWallet() {
    if (!appKit) {
      console.error("AppKit not initialized yet.");
      return;
    }
    try {
      await appKit.open();
      const provider = await appKit.modal.subscribeProvider((state: any) => state?.gip5);
      if (provider) {
        const web3Provider = new ethers.providers.Web3Provider(provider);
        const signer = web3Provider.getSigner();
        const userAddress = await signer.getAddress();
        setConnectedWallet(userAddress);
        console.log("Connected wallet:", userAddress);
      } else {
        console.error("No provider found from AppKit modal.");
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
    }
  }

  function disconnectWallet() {
    setConnectedWallet("");
  }

  function joinCompetition(competitionId: string) {
    if (!joinedCompetitions.includes(competitionId)) {
      setJoinedCompetitions([...joinedCompetitions, competitionId]);
    }
  }

  function login(name: string) {
    setDisplayName(name);
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



