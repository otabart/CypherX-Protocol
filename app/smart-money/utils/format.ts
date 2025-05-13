// app/smart-money/utils/format.ts

/**
 * Formats a token balance to a readable string with a fixed number of decimal places.
 * @param balance The balance as a string (e.g., from Alchemy API).
 * @param decimals The number of decimal places to display (default: 2).
 * @returns Formatted balance string (e.g., "1234.56").
 */
export const formatBalance = (balance: string, decimals: number = 2): string => {
  try {
    const num = parseFloat(balance);
    if (isNaN(num)) {
      return '0.00'; // Fallback for invalid numbers
    }
    return num.toFixed(decimals).replace(/\.?0+$/, ''); // Remove trailing zeros
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0.00';
  }
};

/**
 * Formats a wallet address for display by truncating it.
 * @param address The wallet address (e.g., "0x1234567890abcdef1234567890abcdef12345678").
 * @param chars The number of characters to show at the start and end (default: 6).
 * @returns Truncated address (e.g., "0x1234...5678").
 */
export const formatAddress = (address: string, chars: number = 6): string => {
  if (!address || typeof address !== 'string' || address.length < 12) {
    return address || 'Invalid Address';
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Formats a transaction value for display, handling both ETH and token values.
 * @param value The transaction value as a string (e.g., from Alchemy API).
 * @param decimals The number of decimal places to display (default: 4).
 * @returns Formatted value string (e.g., "1.2345").
 */
export const formatTransactionValue = (value: string, decimals: number = 4): string => {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return '0.0000'; // Fallback for invalid numbers
    }
    return num.toFixed(decimals).replace(/\.?0+$/, ''); // Remove trailing zeros
  } catch (error) {
    console.error('Error formatting transaction value:', error);
    return '0.0000';
  }
};