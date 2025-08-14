import { Router } from 'express';
import { SimpleAuthService } from '@/services/simpleAuthService';
import { loginRateLimiter } from '@/middleware/rateLimiter';
import { honeypot } from '@/middleware/auth';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { logger } from '@/config/logger';
import { LoginRequest, RefreshTokenRequest } from '@/types';

const router = Router();

// Login endpoint with security measures
router.post('/login', 
  // loginRateLimiter, // Temporarily disabled for testing
  honeypot,
  asyncHandler(async (req, res) => {
    const { username, password }: LoginRequest = req.body;
    
    // Validate input
    if (!username || !password) {
      throw createError('Username and password are required', 400);
    }
    
    // Enforce anonymous username pattern
    if (!/^ops-user-\d+$/.test(username)) {
      throw createError('Invalid username format', 400);
    }
    
    const ip = req.ip || '';
    const userAgent = req.get('User-Agent') || '';
    const deviceFingerprint = req.audit?.deviceFingerprint || '';
    const geoLocation = req.geo;
    
    try {
      const result = await SimpleAuthService.login(
        { username, password },
        ip
      );
      
      // Simplified response without refresh token complexity
      res.json(result);
      
    } catch (error) {
      logger.warn('Login attempt failed', {
        username,
        ip,
        userAgent,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Generic error message to prevent user enumeration
      throw createError('Invalid credentials', 401);
    }
  })
);

// Refresh token endpoint (simplified)
router.post('/refresh',
  asyncHandler(async (req, res) => {
    res.json({ 
      success: false, 
      message: 'Refresh functionality temporarily disabled' 
    });
  })
);

// Logout endpoint
router.post('/logout',
  asyncHandler(async (req, res) => {
    const userId = req.body.userId;
    
    if (userId) {
      await SimpleAuthService.logout(userId);
    }
    
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  })
);

// Logout all devices
router.post('/logout-all',
  asyncHandler(async (req, res) => {
    const userId = req.body.userId;
    
    if (!userId) {
      throw createError('User ID required', 400);
    }
    
    await AuthService.logout(userId);
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
    
    res.json({ 
      success: true, 
      message: 'Logged out from all devices' 
    });
  })
);

// Simple test endpoint that bypasses database entirely
router.post('/test-login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'ops-user-1' && password === 'test123') {
      res.json({ 
        success: true,
        token: 'test-token-12345',
        user: { id: 1, username: 'ops-user-1' },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  })
);

// Quick demo login - single user with password
router.post('/demo-login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'ops-user-1' && password === 'demo123') {
      res.json({ 
        success: true,
        token: 'demo-token-' + Date.now(),
        user: { id: 1, username: 'ops-user-1' },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  })
);

// Check authentication status
router.get('/me',
  asyncHandler(async (req, res) => {
    res.json({ 
      authenticated: false,
      message: 'Simplified auth for testing'
    });
  })
);

export default router;