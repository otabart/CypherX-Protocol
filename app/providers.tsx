'use client';

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { LoadingProvider } from "./components/LoadingProvider";

// Create a new query client
const queryClient = new QueryClient();

// Auth context
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

// Wallet system context
interface WalletSystemContextType {
  walletSystem: "wagmi" | "self-custodial";
  setWalletSystem: (system: "wagmi" | "self-custodial") => void;
  selfCustodialWallet: {
    address: string;
    isConnected: boolean;
    ethBalance: string;
    tokenBalance: string;
  } | null;
  setSelfCustodialWallet: (wallet: { address: string; isConnected: boolean; ethBalance: string; tokenBalance: string } | null) => void;
  walletLoading: boolean;
  setWalletLoading: (loading: boolean) => void;
}

const WalletSystemContext = createContext<WalletSystemContextType>({
  walletSystem: "self-custodial",
  setWalletSystem: () => {},
  selfCustodialWallet: null,
  setSelfCustodialWallet: () => {},
  walletLoading: true,
  setWalletLoading: () => {},
});

// Voting modal context
interface VotingModalContextType {
  showVotingModal: boolean;
  setShowVotingModal: (show: boolean) => void;
  selectedIndexForVoting: string;
  setSelectedIndexForVoting: (index: string) => void;
}

const VotingModalContext = createContext<VotingModalContextType>({
  showVotingModal: false,
  setShowVotingModal: () => {},
  selectedIndexForVoting: '',
  setSelectedIndexForVoting: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useWalletSystem = () => {
  const context = useContext(WalletSystemContext);
  if (!context) {
    throw new Error("useWalletSystem must be used within a WalletSystemProvider");
  }
  return context;
};

export const useVotingModal = () => {
  const context = useContext(VotingModalContext);
  if (!context) {
    throw new Error("useVotingModal must be used within a VotingModalProvider");
  }
  return context;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletSystem, setWalletSystem] = useState<"wagmi" | "self-custodial">("self-custodial");
  const [selfCustodialWallet, setSelfCustodialWallet] = useState<{ address: string; isConnected: boolean; ethBalance: string; tokenBalance: string } | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [selectedIndexForVoting, setSelectedIndexForVoting] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <LoadingProvider>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider>
            <AuthContext.Provider value={{ user, loading }}>
              <WalletSystemContext.Provider 
                value={{ 
                  walletSystem, 
                  setWalletSystem, 
                  selfCustodialWallet, 
                  setSelfCustodialWallet,
                  walletLoading,
                  setWalletLoading
                }}
              >
                <VotingModalContext.Provider
                  value={{
                    showVotingModal,
                    setShowVotingModal,
                    selectedIndexForVoting,
                    setSelectedIndexForVoting
                  }}
                >
                  {children}
                </VotingModalContext.Provider>
              </WalletSystemContext.Provider>
            </AuthContext.Provider>
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </LoadingProvider>
  );
}