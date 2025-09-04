import { NextResponse } from 'next/server';

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => Response;
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // General API endpoints
  default: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  
  // Authentication endpoints
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
  
  // Price data endpoints
  price: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per minute
  
  // Wallet operations
  wallet: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 requests per minute
  
  // Points system
  points: { windowMs: 60 * 1000, maxRequests: 50 }, // 50 requests per minute
  
  // Trading operations
  trading: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
  
  // Admin operations
  admin: { windowMs: 60 * 1000, maxRequests: 1000 }, // 1000 requests per minute
} as const;

// Request tracking interface
interface RequestRecord {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

// In-memory store for rate limiting (in production, use Redis)
class RateLimitStore {
  private store = new Map<string, RequestRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000) as unknown as NodeJS.Timeout;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime < now && (!record.blockedUntil || record.blockedUntil < now)) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): RequestRecord | undefined {
    return this.store.get(key);
  }

  set(key: string, record: RequestRecord): void {
    this.store.set(key, record);
  }

  increment(key: string, windowMs: number): RequestRecord {
    const now = Date.now();
    const record = this.store.get(key);
    
    if (!record || record.resetTime < now) {
      const newRecord: RequestRecord = {
        count: 1,
        resetTime: now + windowMs
      };
      this.store.set(key, newRecord);
      return newRecord;
    }
    
    record.count++;
    return record;
  }

  block(key: string, durationMs: number): void {
    const record = this.store.get(key) || { count: 0, resetTime: Date.now() };
    record.blockedUntil = Date.now() + durationMs;
    this.store.set(key, record);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

// Get client identifier for rate limiting
function getClientIdentifier(req: Request): string {
  // Try to get user ID from auth header or session
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Extract user ID from JWT token (simplified)
    return `user:${authHeader.slice(7, 20)}`; // Use first 13 chars of token
  }
  
  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ip:${ip}`;
}

// Rate limiting middleware
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async function rateLimitMiddleware(req: Request): Promise<Response | null> {
    const key = config.keyGenerator ? config.keyGenerator(req) : getClientIdentifier(req);
    const now = Date.now();
    
    // Check if client is blocked
    const record = rateLimitStore.get(key);
    if (record?.blockedUntil && record.blockedUntil > now) {
      const remaining = Math.ceil((record.blockedUntil - now) / 1000);
      return NextResponse.json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${remaining} seconds.`,
        retryAfter: remaining
      }, { status: 429 });
    }
    
    // Increment request count
    const currentRecord = rateLimitStore.increment(key, config.windowMs);
    
    // Check if limit exceeded
    if (currentRecord.count > config.maxRequests) {
      // Block client for 15 minutes if they exceed limit by 50%
      if (currentRecord.count > config.maxRequests * 1.5) {
        rateLimitStore.block(key, 15 * 60 * 1000);
      }
      
      const remaining = Math.ceil((currentRecord.resetTime - now) / 1000);
      return NextResponse.json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${remaining} seconds.`,
        retryAfter: remaining,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - currentRecord.count)
      }, { status: 429 });
    }
    
    // Add rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - currentRecord.count).toString());
    response.headers.set('X-RateLimit-Reset', new Date(currentRecord.resetTime).toISOString());
    
    return null; // Continue to next middleware
  };
}

// Abuse detection middleware
export function createAbuseDetectionMiddleware() {
  return async function abuseDetectionMiddleware(req: Request): Promise<Response | null> {
    const clientId = getClientIdentifier(req);
    const userAgent = req.headers.get('user-agent') || '';
    const referer = req.headers.get('referer') || '';
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /bot|crawler|spider/i.test(userAgent),
      !userAgent || userAgent.length < 10,
      userAgent.includes('curl') && !userAgent.includes('CypherX'),
      referer.includes('suspicious-domain.com'),
      req.url.includes('admin') && !userAgent.includes('CypherX'),
    ];
    
    const suspiciousScore = suspiciousPatterns.filter(Boolean).length;
    
    if (suspiciousScore >= 2) {
      // Log suspicious activity
      console.warn(`Suspicious activity detected from ${clientId}:`, {
        userAgent,
        referer,
        url: req.url,
        score: suspiciousScore
      });
      
      // Block for 1 hour if very suspicious
      if (suspiciousScore >= 3) {
        rateLimitStore.block(clientId, 60 * 60 * 1000);
        return NextResponse.json({
          error: 'Access denied',
          message: 'Suspicious activity detected'
        }, { status: 403 });
      }
    }
    
    return null;
  };
}

// Input validation middleware
export function createInputValidationMiddleware() {
  return async function inputValidationMiddleware(req: Request): Promise<Response | null> {
    // Validate request size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
      return NextResponse.json({
        error: 'Request too large',
        message: 'Request body exceeds 1MB limit'
      }, { status: 413 });
    }
    
    // Validate content type for POST requests
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return NextResponse.json({
          error: 'Invalid content type',
          message: 'Content-Type must be application/json'
        }, { status: 400 });
      }
    }
    
    return null;
  };
}

// Authentication middleware
export function createAuthMiddleware(requireAuth: boolean = true) {
  return async function authMiddleware(req: Request): Promise<Response | null> {
    if (!requireAuth) return null;
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      }, { status: 401 });
    }
    
    // TODO: Implement proper JWT validation
    // For now, just check if token exists
    const token = authHeader.slice(7);
    if (!token || token.length < 10) {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Authentication token is invalid'
      }, { status: 401 });
    }
    
    return null;
  };
}

// CORS middleware
export function createCORSMiddleware() {
  return async function corsMiddleware(req: Request): Promise<Response | null> {
    const origin = req.headers.get('origin');
    const allowedOrigins = [
      'http://localhost:3000',
      'https://cypherx.com',
      'https://www.cypherx.com'
    ];
    
    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json({
        error: 'CORS error',
        message: 'Origin not allowed'
      }, { status: 403 });
    }
    
    return null;
  };
}

// Request logging middleware
export function createLoggingMiddleware() {
  return async function loggingMiddleware(req: Request): Promise<Response | null> {
    const startTime = Date.now();
    const clientId = getClientIdentifier(req);
    
    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${clientId}`);
    
    // Add response time header
    const response = NextResponse.next();
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    
    return null;
  };
}

// Combine all middleware
export function createAPIMiddleware(options: {
  rateLimit?: keyof typeof RATE_LIMITS;
  requireAuth?: boolean;
  enableCORS?: boolean;
  enableLogging?: boolean;
  enableAbuseDetection?: boolean;
  enableInputValidation?: boolean;
} = {}) {
  const {
    rateLimit = 'default',
    requireAuth = false,
    enableCORS = true,
    enableLogging = true,
    enableAbuseDetection = true,
    enableInputValidation = true
  } = options;
  
  const middleware: Array<(req: Request) => Promise<Response | null>> = [];
  
  // Add middleware in order
  if (enableLogging) {
    middleware.push(createLoggingMiddleware());
  }
  
  if (enableCORS) {
    middleware.push(createCORSMiddleware());
  }
  
  if (enableInputValidation) {
    middleware.push(createInputValidationMiddleware());
  }
  
  if (enableAbuseDetection) {
    middleware.push(createAbuseDetectionMiddleware());
  }
  
  if (rateLimit) {
    middleware.push(createRateLimitMiddleware(RATE_LIMITS[rateLimit]));
  }
  
  if (requireAuth) {
    middleware.push(createAuthMiddleware(requireAuth));
  }
  
  // Return combined middleware function
  return async function combinedMiddleware(req: Request): Promise<Response | null> {
    for (const mw of middleware) {
      const result = await mw(req);
      if (result) return result;
    }
    return null;
  };
}

// Utility function to get rate limit info
export function getRateLimitInfo(clientId: string, rateLimitType: keyof typeof RATE_LIMITS) {
  const config = RATE_LIMITS[rateLimitType];
  const record = rateLimitStore.get(clientId);
  
  if (!record) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs).toISOString()
    };
  }
  
  const now = Date.now();
  const remaining = Math.max(0, config.maxRequests - record.count);
  const resetTime = new Date(record.resetTime).toISOString();
  
  return {
    limit: config.maxRequests,
    remaining,
    resetTime,
    blocked: record.blockedUntil ? record.blockedUntil > now : false
  };
}

// Cleanup function for graceful shutdown
export function cleanupAPIMiddleware() {
  rateLimitStore.destroy();
}
