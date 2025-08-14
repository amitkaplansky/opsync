import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';
import { logger } from '@/config/logger';

const ALLOWED_COUNTRIES = (process.env.ALLOWED_COUNTRIES || 'IL').split(',');

export const geoBlocker = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip geo-blocking in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Handle localhost and private IPs
    if (
      clientIP === '127.0.0.1' || 
      clientIP === '::1' || 
      clientIP.startsWith('192.168.') ||
      clientIP.startsWith('10.') ||
      clientIP.startsWith('172.')
    ) {
      return next();
    }
    
    const geo = geoip.lookup(clientIP);
    
    if (!geo) {
      logger.warn(`Unknown geolocation for IP: ${clientIP}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'Unable to determine location'
      });
    }
    
    if (!ALLOWED_COUNTRIES.includes(geo.country)) {
      logger.warn(`Blocked access from ${geo.country}`, {
        ip: clientIP,
        country: geo.country,
        city: geo.city,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Service not available in your region'
      });
    }
    
    // Add geo info to request for audit logging
    req.geo = {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone
    };
    
    next();
    
  } catch (error) {
    logger.error('Geo-blocking error:', error);
    // Fail securely - block on error
    res.status(403).json({
      error: 'Access denied',
      message: 'Geographic validation failed'
    });
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      geo?: {
        country: string;
        region: string;
        city: string;
        timezone: string;
      };
    }
  }
}