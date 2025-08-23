import { adminDb } from "@/lib/firebase-admin";

export interface SwapMetrics {
  success: boolean;
  transactionHash?: string;
  gasUsed?: string;
  gasPrice?: string;
  error?: string;
  errorType?: string;
  poolInfo?: {
    address: string;
    fee: number;
    liquidity: string;
  };
  executionTime?: number;
  timestamp: string;
  walletAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
}

export interface ErrorMetrics {
  error: string;
  errorType: string;
  details: string;
  timestamp: string;
  context: {
    walletAddress?: string;
    inputToken?: string;
    outputToken?: string;
    inputAmount?: string;
    outputAmount?: string;
  };
  stack?: string;
}

/**
 * Records swap metrics for monitoring and analytics
 */
export async function recordSwapMetrics(metrics: SwapMetrics): Promise<void> {
  const db = adminDb();
  if (!db) {
    console.error("Database connection failed for metrics recording");
    return;
  }

  try {
    await db.collection("swap_metrics").add({
      ...metrics,
      createdAt: new Date()
    });
    
    console.log("📊 Swap metrics recorded:", {
      success: metrics.success,
      transactionHash: metrics.transactionHash,
      gasUsed: metrics.gasUsed,
      executionTime: metrics.executionTime
    });
  } catch (error) {
    console.error("❌ Failed to record swap metrics:", error);
  }
}

/**
 * Records error metrics for debugging and monitoring
 */
export async function recordErrorMetrics(error: ErrorMetrics): Promise<void> {
  const db = adminDb();
  if (!db) {
    console.error("Database connection failed for error recording");
    return;
  }

  try {
    await db.collection("error_metrics").add({
      ...error,
      createdAt: new Date()
    });
    
    console.log("🚨 Error metrics recorded:", {
      error: error.error,
      errorType: error.errorType,
      timestamp: error.timestamp
    });
  } catch (dbError) {
    console.error("❌ Failed to record error metrics:", dbError);
  }
}

/**
 * Categorizes errors for better monitoring
 */
export function categorizeError(error: string): string {
  if (error.includes("execution reverted")) {
    return "CONTRACT_REVERT";
  }
  if (error.includes("insufficient")) {
    return "INSUFFICIENT_BALANCE";
  }
  if (error.includes("No Uniswap V3 pools found")) {
    return "NO_POOL_FOUND";
  }
  if (error.includes("timeout")) {
    return "TIMEOUT";
  }
  if (error.includes("nonce")) {
    return "NONCE_ERROR";
  }
  if (error.includes("gas")) {
    return "GAS_ERROR";
  }
  if (error.includes("price impact")) {
    return "PRICE_IMPACT";
  }
  return "UNKNOWN_ERROR";
}

/**
 * Performance monitoring wrapper
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const executionTime = Date.now() - startTime;
      
      console.log(`⏱️ ${operationName} completed in ${executionTime}ms`);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ ${operationName} failed after ${executionTime}ms:`, error);
      throw error;
    }
  };
}

/**
 * Error tracking with context
 */
export function trackError(
  error: Error,
  context: {
    operation: string;
    walletAddress?: string;
    inputToken?: string;
    outputToken?: string;
    inputAmount?: string;
    outputAmount?: string;
  }
): void {
  const errorMetrics: ErrorMetrics = {
    error: error.message,
    errorType: categorizeError(error.message),
    details: error.stack || "No stack trace available",
    timestamp: new Date().toISOString(),
    context: {
      walletAddress: context.walletAddress,
      inputToken: context.inputToken,
      outputToken: context.outputToken,
      inputAmount: context.inputAmount,
      outputAmount: context.outputAmount
    },
    stack: error.stack
  };
  
  // Record error metrics
  recordErrorMetrics(errorMetrics).catch(console.error);
  
  // Log to console for immediate debugging
  console.error(`🚨 Error in ${context.operation}:`, {
    message: error.message,
    type: errorMetrics.errorType,
    context: context
  });
}

/**
 * Swap success tracking
 */
export function trackSwapSuccess(metrics: Omit<SwapMetrics, 'success' | 'timestamp'>): void {
  const swapMetrics: SwapMetrics = {
    ...metrics,
    success: true,
    timestamp: new Date().toISOString()
  };
  
  recordSwapMetrics(swapMetrics).catch(console.error);
}

/**
 * Swap failure tracking
 */
export function trackSwapFailure(
  error: string,
  context: {
    walletAddress: string;
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    outputAmount: string;
    slippage: number;
    poolInfo?: {
      address: string;
      fee: number;
      liquidity: string;
    };
  }
): void {
  const swapMetrics: SwapMetrics = {
    success: false,
    error,
    errorType: categorizeError(error),
    timestamp: new Date().toISOString(),
    walletAddress: context.walletAddress,
    inputToken: context.inputToken,
    outputToken: context.outputToken,
    inputAmount: context.inputAmount,
    outputAmount: context.outputAmount,
    slippage: context.slippage,
    poolInfo: context.poolInfo
  };
  
  recordSwapMetrics(swapMetrics).catch(console.error);
}

/**
 * Health check for monitoring system
 */
export async function checkMonitoringHealth(): Promise<{
  database: boolean;
  timestamp: string;
}> {
  const db = adminDb();
  if (!db) {
    return {
      database: false,
      timestamp: new Date().toISOString()
    };
  }

  try {
    // Try to write a test document
    await db.collection("health_check").add({
      timestamp: new Date(),
      status: "healthy"
    });
    
    return {
      database: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("❌ Monitoring health check failed:", error);
    return {
      database: false,
      timestamp: new Date().toISOString()
    };
  }
}
