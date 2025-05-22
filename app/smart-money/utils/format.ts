export const formatBalance = (balance: string, decimals: number = 2): string => {
  try {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0.00';
  }
};

export const formatAddress = (address: string, chars: number = 6): string => {
  if (!address || typeof address !== 'string' || address.length < 12) return address || 'Invalid Address';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const formatTransactionValue = (value: string, decimals: number = 4): string => {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.0000';
    return num.toFixed(decimals).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting transaction value:', error);
    return '0.0000';
  }
};

export const formatTimestamp = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'N/A';
  }
};