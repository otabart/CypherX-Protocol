'use client';

import { useState } from 'react';
import { useWalletSystem } from '@/app/providers';

interface TransactionConfig {
  action: string;
  points: number;
  description: string;
  metadata?: any;
}

interface UsePointTransactionReturn {
  showTransactionModal: boolean;
  setShowTransactionModal: (show: boolean) => void;
  executeTransaction: (config: TransactionConfig, onSuccess?: () => void) => void;
  transaction: TransactionConfig | null;
  userPoints: number;
  walletAddress?: string;
  onConfirm: () => void;
}

export const usePointTransaction = (): UsePointTransactionReturn => {

  const { selfCustodialWallet } = useWalletSystem();
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transaction, setTransaction] = useState<TransactionConfig | null>(null);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

  const walletAddress = selfCustodialWallet?.address;
  const userPoints = 0; // This should be fetched from your points system

  const executeTransaction = (config: TransactionConfig, onSuccess?: () => void) => {
    setTransaction(config);
    setOnSuccessCallback(() => onSuccess);
    setShowTransactionModal(true);
  };

  const onConfirm = () => {
    if (onSuccessCallback) {
      onSuccessCallback();
    }
    setShowTransactionModal(false);
    setTransaction(null);
    setOnSuccessCallback(null);
  };

  return {
    showTransactionModal,
    setShowTransactionModal,
    executeTransaction,
    transaction,
    userPoints,
    walletAddress,
    onConfirm
  };
};
