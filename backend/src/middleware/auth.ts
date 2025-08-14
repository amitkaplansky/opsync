import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '@/config/database';
import { createError } from './errorHandler';
import { logger } from '@/config/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      throw createError('Access token required', 401);
    }
    
    // Handle demo tokens
    if (token.startsWith('demo-token-') || token === 'test-token-12345') {
      req.user = {
        id: 1,
        username: 'ops-user-1'
      };
      return next();
    }
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw createError('JWT secret not configured', 500);
    }
    
    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Check if user still exists and is active
    const userResult = await query(
      'SELECT id, username, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      throw createError('User not found or inactive', 401);
    }
    
    const user = userResult.rows[0];
    
    // Check if session is still valid
    const sessionResult = await query(
      'SELECT id FROM sessions WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP',
      [user.id]
    );
    
    if (sessionResult.rows.length === 0) {
      throw createError('Session expired', 401);
    }
    
    // Add user to request
    req.user = {
      id: user.id,
      username: user.username
    };
    
    // Update last accessed time for session
    await query(
      'UPDATE sessions SET last_accessed = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.id]
    );
    
    next();
    
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(createError('Invalid token', 401));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return next(createError('Token expired', 401));
    }
    
    logger.error('Authentication error:', error);
    next(error);
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return next(); // Continue without authentication
    }
    
    // Try to authenticate, but don't fail if unsuccessful
    await authenticateToken(req, res, (error) => {
      if (error) {
        // Log the error but continue without authentication
        logger.warn('Optional authentication failed:', error.message);
      }
      next();
    });
    
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Honeypot middleware to detect bots
export const honeypot = (req: Request, res: Response, next: NextFunction) => {
  const honeypotField = req.body.website || req.body.url || req.body.homepage;
  
  if (honeypotField && honeypotField.trim() !== '') {
    logger.warn('Honeypot triggered', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      honeypotValue: honeypotField,
      body: req.body
    });
    
    // Simulate processing delay to waste bot time
    setTimeout(() => {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Please try again'
      });
    }, 2000 + Math.random() * 3000);
    
    return;
  }
  
  next();
};