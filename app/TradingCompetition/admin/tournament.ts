// pages/api/admin/tournaments.ts
import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ethers } from "ethers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const {
      title,
      description,
      entryFee,
      prizeFundingType,
      fixedPrizePool,
      basePrizePool,
      contributionPerParticipant,
      startDate,
      maxParticipants,
    } = req.body;

    // Basic validation
    if (!title || !description || entryFee <= 0 || !startDate || maxParticipants <= 0) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }

    try {
      // Setup Ethereum provider and signer (for server-side use; replace with your config)
      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || "https://mainnet.base.org");
      const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY || "your-private-key-here", provider); // Secure this in production!

      const TRADING_COMPETITION_ADDRESS = "0xYourContractAddressHere"; // Replace with your contract address
      const TRADING_COMPETITION_ABI = [
        "function createCompetition(string title, string description, uint256 entryFee, string prizeFundingType, uint256 fixedPrizePool, uint256 basePrizePool, uint256 contributionPerParticipant, uint256 startTimestamp, uint256 maxParticipants) public",
      ];

      const contract = new ethers.Contract(TRADING_COMPETITION_ADDRESS, TRADING_COMPETITION_ABI, signer);

      // Convert values for blockchain
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const tx = await contract.createCompetition(
        title,
        description,
        ethers.parseEther(entryFee.toString()), // Assuming ETH; adjust if USDC
        prizeFundingType,
        ethers.parseEther(fixedPrizePool?.toString() || "0"),
        ethers.parseEther(basePrizePool?.toString() || "0"),
        ethers.parseEther(contributionPerParticipant?.toString() || "0"),
        startTimestamp,
        maxParticipants
      );

      const receipt = await tx.wait();
      const tournamentId = receipt.logs[0]?.topics[1] || receipt.transactionHash; // Adjust based on your event emission

      // Optional: Sync to Firebase
      const docRef = await addDoc(collection(db, "tournaments"), {
        title,
        description,
        entryFee,
        prizeFundingType,
        fixedPrizePool: fixedPrizePool || 0,
        basePrizePool: basePrizePool || 0,
        contributionPerParticipant: contributionPerParticipant || 0,
        startDate,
        maxParticipants,
        txHash: tx.hash,
        createdAt: serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        tournament: {
          id: docRef.id,
          title,
          description,
          entryFee,
          prizeFundingType,
          fixedPrizePool,
          basePrizePool,
          contributionPerParticipant,
          startDate,
          maxParticipants,
          txHash: tx.hash,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Failed to create tournament" });
    }
  } else {
    res.status(405).json({ success: false, message: "Method not allowed" });
  }
}
