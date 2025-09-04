// Error handling utilities for user-friendly messages

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export const ErrorMessages = {
  // Network errors
  NETWORK_ERROR: "Network connection failed. Please check your internet connection.",
  TIMEOUT_ERROR: "Request timed out. Please try again.",
  
  // API errors
  API_UNAVAILABLE: "Service temporarily unavailable. Please try again later.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a moment and try again.",
  INVALID_REQUEST: "Invalid request. Please check your input and try again.",
  
  // Wallet errors
  WALLET_NOT_FOUND: "Wallet not found. Please check your wallet address.",
  WALLET_LOAD_FAILED: "Failed to load wallet data. Please try again.",
  TRANSACTION_FAILED: "Transaction failed. Please try again.",
  INSUFFICIENT_BALANCE: "Insufficient balance for this transaction.",
  
  // Price data errors
  PRICE_UNAVAILABLE: "Price data temporarily unavailable.",
  TOKEN_NOT_FOUND: "Token information not found.",
  
  // Authentication errors
  AUTHENTICATION_FAILED: "Authentication failed. Please log in again.",
  SESSION_EXPIRED: "Session expired. Please log in again.",
  
  // Generic errors
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
  DATA_LOAD_FAILED: "Failed to load data. Please refresh the page.",
  OPERATION_FAILED: "Operation failed. Please try again.",
} as const;

export function getErrorMessage(error: unknown, context?: string): string {
  if (!error) return ErrorMessages.UNKNOWN_ERROR;
  
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorMessages.NETWORK_ERROR;
    }
    if (message.includes('timeout')) {
      return ErrorMessages.TIMEOUT_ERROR;
    }
    
    // API errors
    if (message.includes('rate limit') || message.includes('429')) {
      return ErrorMessages.RATE_LIMIT_EXCEEDED;
    }
    if (message.includes('400') || message.includes('bad request')) {
      return ErrorMessages.INVALID_REQUEST;
    }
    if (message.includes('500') || message.includes('server error')) {
      return ErrorMessages.API_UNAVAILABLE;
    }
    
    // Wallet-specific errors
    if (context === 'wallet') {
      if (message.includes('not found') || message.includes('404')) {
        return ErrorMessages.WALLET_NOT_FOUND;
      }
      if (message.includes('insufficient') || message.includes('balance')) {
        return ErrorMessages.INSUFFICIENT_BALANCE;
      }
      if (message.includes('transaction')) {
        return ErrorMessages.TRANSACTION_FAILED;
      }
    }
    
    // Price data errors
    if (context === 'price') {
      if (message.includes('not found') || message.includes('404')) {
        return ErrorMessages.TOKEN_NOT_FOUND;
      }
      return ErrorMessages.PRICE_UNAVAILABLE;
    }
    
    // Authentication errors
    if (context === 'auth') {
      if (message.includes('unauthorized') || message.includes('401')) {
        return ErrorMessages.AUTHENTICATION_FAILED;
      }
      if (message.includes('expired')) {
        return ErrorMessages.SESSION_EXPIRED;
      }
    }
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    const message = error.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorMessages.NETWORK_ERROR;
    }
    if (message.includes('timeout')) {
      return ErrorMessages.TIMEOUT_ERROR;
    }
  }
  
  // Handle API response errors
  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    
    if (apiError.status === 429) {
      return ErrorMessages.RATE_LIMIT_EXCEEDED;
    }
    if (apiError.status === 400) {
      return ErrorMessages.INVALID_REQUEST;
    }
    if (apiError.status === 500) {
      return ErrorMessages.API_UNAVAILABLE;
    }
    if (apiError.status === 401) {
      return ErrorMessages.AUTHENTICATION_FAILED;
    }
    if (apiError.status === 404) {
      if (context === 'wallet') return ErrorMessages.WALLET_NOT_FOUND;
      if (context === 'price') return ErrorMessages.TOKEN_NOT_FOUND;
      return ErrorMessages.DATA_LOAD_FAILED;
    }
  }
  
  // Default error message based on context
  switch (context) {
    case 'wallet':
      return ErrorMessages.WALLET_LOAD_FAILED;
    case 'price':
      return ErrorMessages.PRICE_UNAVAILABLE;
    case 'auth':
      return ErrorMessages.AUTHENTICATION_FAILED;
    case 'data':
      return ErrorMessages.DATA_LOAD_FAILED;
    default:
      return ErrorMessages.UNKNOWN_ERROR;
  }
}

export function logError(error: unknown, context?: string): void {
  // In development, log the full error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context || 'Unknown'}] Error:`, error);
  } else {
    // In production, log a sanitized version
    const userMessage = getErrorMessage(error, context);
    console.error(`[${context || 'Unknown'}] User-facing error:`, userMessage);
  }
}

export function createErrorHandler(context?: string) {
  return (error: unknown) => {
    logError(error, context);
    return getErrorMessage(error, context);
  };
}
