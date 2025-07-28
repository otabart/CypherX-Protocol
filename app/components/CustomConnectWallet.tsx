"use client";

import React, { useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

const CustomConnectWallet: React.FC = () => {
  const { address, isConnected, chainId } = useAccount();
  const { data: balance, isLoading } = useBalance({
    address: address,
    chainId: base.id,
  });

  useEffect(() => {
    console.log("Balance Data:", { address, balance, isLoading, chainId, isConnected });
  }, [address, balance, isLoading, chainId, isConnected]);

  return (
    <div className="relative">
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
          const connected = mounted && account && chain;
          return (
            <>
              {(() => {
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-inter uppercase tracking-wide hover:bg-blue-500/40 border border-blue-500/30 transition-colors"
                    >
                      Connect Wallet
                    </button>
                  );
                }
                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-inter uppercase tracking-wide hover:bg-red-500/40 border border-red-500/30 transition-colors"
                    >
                      Wrong Network
                    </button>
                  );
                }
                return (
                  <button
                    onClick={openAccountModal}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-inter uppercase tracking-wide hover:bg-blue-500/40 border border-blue-500/30 transition-colors flex items-center space-x-1"
                  >
                    <span>
                      {account.displayName}
                    </span>
                    {!isLoading && balance && (
                      <span>
                        {parseFloat(balance.formatted).toFixed(4)} ETH
                      </span>
                    )}
                  </button>
                );
              })()}
            </>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
};

export default CustomConnectWallet;
