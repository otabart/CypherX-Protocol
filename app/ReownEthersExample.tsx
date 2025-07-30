"use client";
import React, { useEffect, useState } from "react";
import { createAppKit } from "@reown/appkit";
import { mainnet } from "@reown/appkit/networks";

export default function ReownEthersExample() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [appKit, setAppKit] = useState<any>(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    // 1) Provide your Reown Cloud "projectId"
    const projectId = "YOUR_PROJECT_ID"; // e.g. from .env or your Reown Cloud Dashboard

    // 2) Create the AppKit instance with minimal configuration
    const kit = createAppKit({
        projectId,
      networks: [mainnet], // Add the required networks property
      metadata: {
        name: "My AppKit App",
        url: "https://example.com",
        description: "A sample integration with Reown AppKit",
        icons: ["https://example.com/icon.png"],
      },
    });

    // 3) Store the instance in local state so we can access it later
    setAppKit(kit);
  }, []);

  // When the user clicks "Connect Wallet"
  const handleConnect = async () => {
    if (!appKit) return;

    try {
      // 4) Open the Reown wallet modal
    await appKit.open();

      // 5) Get the connected account
      const accounts = await appKit.getAccounts();
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
      setAddress(userAddress);
      console.log("Connected address:", userAddress);
    } else {
        console.log("No accounts found.");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect Wallet</button>
      {address && <p>Connected as: {address}</p>}
    </div>
  );
}
