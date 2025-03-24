"use client";
import React, { useEffect, useState } from "react";
import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet } from "@reown/appkit/networks";
import { ethers } from "ethers";

export default function ReownEthersExample() {
  const [appKit, setAppKit] = useState<any>(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    // 1) Provide your Reown Cloud "projectId"
    const projectId = "YOUR_PROJECT_ID"; // e.g. from .env or your Reown Cloud Dashboard

    // 2) Metadata must match your domain/subdomain (for Reown's Verify API)
    const metadata = {
      name: "My AppKit App",
      url: "https://example.com", // Replace with your actual dApp URL
      description: "A sample integration with Reown AppKit",
    };

    // 3) Create the AppKit instance with EthersAdapter
    const kit = createAppKit({
      adapter: new EthersAdapter({
        chain: mainnet,  // or any other supported chain
        projectId,
        // features: { mint: true }, // optional, depending on your needs
      }),
      metadata,
    });

    // 4) Initialize AppKit
    kit.init();

    // 5) Store the instance in local state so we can access it later
    setAppKit(kit);
  }, []);

  // When the user clicks "Connect Wallet"
  const handleConnect = async () => {
    if (!appKit) return;

    // 6) Open the Reown wallet modal
    await appKit.open();

    // 7) Subscribe to the provider (the modal returns a GIP-5 provider)
    const provider = await appKit.modal.subscribeProvider((state: any) => {
      return state?.gip5;
    });

    // 8) Use Ethers.js to get the signer & address
    if (provider) {
      const web3Provider = new ethers.providers.Web3Provider(provider);
      const signer = web3Provider.getSigner();
      const userAddress = await signer.getAddress();
      setAddress(userAddress);
      console.log("Connected address:", userAddress);
    } else {
      console.log("No provider found.");
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect Wallet</button>
      {address && <p>Connected as: {address}</p>}
    </div>
  );
}
