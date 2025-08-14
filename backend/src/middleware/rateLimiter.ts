import rateLimit from 'express-rate-limit';
import { getRedisClient, increment } from '@/config/redis';
import { logger } from '@/config/logger';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5');

export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  
  store: {
    incr: async (key: string) => {
      try {
        const client = getRedisClient();
        const current = await increment(key, Math.ceil(WINDOW_MS / 1000));
        return { totalHits: current, resetTime: new Date(Date.now() + WINDOW_MS) };
      } catch (error) {
        logger.error('Rate limiter Redis error:', error);
        throw error;
      }
    },
    
    decrement: async (key: string) => {
      // Redis TTL handles cleanup
    },
    
    resetAll: async () => {
      // Not implemented for security reasons
    }
  },
  
  keyGenerator: (req) => {
    // Combine IP and User-Agent for fingerprinting
    const ip = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.get('User-Agent') || '';
    const fingerprint = Buffer.from(`${ip}:${userAgent}`).toString('base64');
    return `rate_limit:${fingerprint}`;
  },
  
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(WINDOW_MS / 1000)
    });
  },
  
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// Specific rate limiter for login attempts
export const loginRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    const ip = req.ip || '';
    const username = req.body?.username || '';
    return `login_attempts:${ip}:${username}`;
  },
  
  handler: (req, res) => {
    logger.warn(`Login rate limit exceeded`, {
      ip: req.ip,
      username: req.body?.username,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Account temporarily locked. Please try again later.',
      retryAfter: Math.ceil(WINDOW_MS / 1000)
    });
  }
});