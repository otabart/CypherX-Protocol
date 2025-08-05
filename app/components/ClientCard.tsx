'use client';

import { useState } from 'react';
import { ShoppingBagIcon, SparklesIcon, UserIcon, RocketLaunchIcon, MegaphoneIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseUnits } from 'viem';

// Define MarketplaceItem type directly (to avoid path issues)
interface MarketplaceItem {
  id?: number;
  name: string;
  price?: string;
  category?: 'Advertisement' | 'TokenBoost' | 'ExplorerProfile' | 'Bump Bot' | 'Telegram';
  description: string;
  available?: boolean;
  duration?: string;
}

// Define icon mapping type
interface IconMap {
  Advertisement: typeof ShoppingBagIcon;
  TokenBoost: typeof SparklesIcon;
  ExplorerProfile: typeof UserIcon;
  'Bump Bot': typeof RocketLaunchIcon;
  Telegram: typeof MegaphoneIcon;
}

// Animation variants for cards
const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

// USDC contract ABI (minimal for transfer function)
const USDC_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

// USDC contract address on Base Mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const RECIPIENT_ADDRESS = '0x4146E18FeF6883Ee7c2F16feC60109133F1Fc491';

const ClientCard = ({ item, isComingSoon = false }: { item: MarketplaceItem; isComingSoon?: boolean }) => {
  const icons: IconMap = {
    Advertisement: ShoppingBagIcon,
    TokenBoost: SparklesIcon,
    ExplorerProfile: UserIcon,
    'Bump Bot': RocketLaunchIcon,
    Telegram: MegaphoneIcon,
  };

  // Safely determine the icon key with a fallback
  const iconKey = item.category || (item.name.includes('Bump Bot') ? 'Bump Bot' : 'Telegram');
  const Icon = icons[iconKey as keyof IconMap]; // Type assertion to ensure key is valid

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { data: usdcBalance } = useBalance({
    address,
    token: USDC_ADDRESS,
    chainId: 8453, // Base Mainnet chain ID
  });

  const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handlePurchase = async () => {
    // Reset states
    setError(null);
    setTxHash(null);

    if (!isConnected) {
      setError('Please connect your wallet to proceed with the purchase.');
      return;
    }

    if (!item.price) {
      setError('Price not specified for this item.');
      return;
    }

    // Extract the numeric value from the price (e.g., "50 USDC" -> 50)
    const priceValue = parseFloat(item.price.split(' ')[0]);
    if (isNaN(priceValue)) {
      setError('Invalid price format. Please contact support.');
      return;
    }

    // Check USDC balance (USDC has 6 decimals)
    const balance = usdcBalance ? parseFloat(usdcBalance.formatted) : 0;
    if (balance < priceValue) {
      setError(`Insufficient USDC balance. You have ${balance.toFixed(2)} USDC, but need ${priceValue} USDC.`);
      return;
    }

    setIsPurchasing(true);

    try {
      // Convert price to USDC units (6 decimals)
      const amount = parseUnits(priceValue.toString(), 6);

      // Send USDC to the recipient address
      writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [RECIPIENT_ADDRESS, amount],
      });
    } catch {
      setError('Failed to initiate transaction. Please try again or contact support.');
      setIsPurchasing(false);
    }
  };

  // Handle transaction status
  if (writeError) {
    const errorMessage = writeError.message.includes('User rejected')
      ? 'Transaction rejected by user.'
      : 'Transaction failed: ' + writeError.message;
    setError(errorMessage);
    setIsPurchasing(false);
  }

  if (hash && !txHash) {
    setTxHash(hash);
  }

  if (isConfirmed) {
    setIsPurchasing(false);
    setShowModal(true);
    setError(null); // Clear any previous errors on success
  }

  const handleModalClose = () => {
    setShowModal(false);
    setTxHash(null);
    setError(null); // Reset error state when modal closes
  };

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-gray-900 p-6 rounded-lg border border-blue-500/20 relative shadow-lg hover:shadow-[0_0_8px_rgba(37,99,235,0.2)] transition-all duration-300 group"
      >
        {/* Badge */}
        <span
          className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs uppercase ${
            isComingSoon ? 'bg-gray-700 text-gray-400' : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {isComingSoon ? 'Coming Soon' : 'Available'}
        </span>
        <div className="flex items-center mb-3">
          <Icon className="h-6 w-6 text-blue-400 mr-3" />
          <h3 className="text-lg font-semibold text-white uppercase">{item.name}</h3>
        </div>
        <p className="text-gray-400 text-sm mb-4 group-hover:text-gray-300 transition-colors duration-300">
          {item.description}
        </p>
        <div>
          {item.price && (
            <p className="text-blue-400 font-medium text-base mb-4">
              Price: {item.price} {item.duration && `(${item.duration})`}
            </p>
          )}
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button
            onClick={handlePurchase}
            disabled={isPurchasing || !item.available || isWritePending || isConfirming}
            className={`w-full py-2 rounded-lg text-sm font-medium uppercase transition-all duration-300 ${
              item.available && !isPurchasing && !isWritePending && !isConfirming
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 border border-blue-500/30'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }`}
          >
            {isWritePending || isPurchasing
              ? 'Processing...'
              : isConfirming
              ? 'Confirming...'
              : item.available
              ? 'Buy Now'
              : 'Locked'}
          </button>
        </div>
      </motion.div>

      {/* Purchase Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-gray-900 p-6 rounded-lg border border-blue-500/20 max-w-md w-full">
            <h3 className="text-xl font-semibold text-blue-400 mb-4">Purchase Successful!</h3>
            <p className="text-gray-400 mb-4">
              You have successfully purchased “{item.name}” for {item.price}.
            </p>
            {txHash && (
              <p className="text-gray-400Australian Dollar mb-4 break-all">
                Transaction Hash:{' '}
                <a
                  href={`/explorer/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  {txHash.slice(0, 6)}...{txHash.slice(-4)}
                </a>
              </p>
            )}
            <p className="text-gray-400Australian Dollar mb-4">Check your dashboard for more details.</p>
            <button
              onClick={handleModalClose}
              className="w-full bg-blue-500/20 text-blue-400 py-2 rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientCard;