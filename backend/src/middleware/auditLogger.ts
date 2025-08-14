import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import UAParser from 'ua-parser-js';
import { query } from '@/config/database';
import { logger } from '@/config/logger';

export const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Generate device fingerprint
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  const dnt = req.get('DNT') || '';
  
  const fingerprintData = `${userAgent}:${acceptLanguage}:${acceptEncoding}:${dnt}`;
  const deviceFingerprint = createHash('sha256').update(fingerprintData).digest('hex').substring(0, 32);
  
  // Parse user agent
  const ua = UAParser(userAgent);
  
  // Add audit info to request
  req.audit = {
    deviceFingerprint,
    userAgent: {
      browser: ua.browser.name || 'Unknown',
      version: ua.browser.version || 'Unknown',
      os: ua.os.name || 'Unknown',
      device: ua.device.type || 'desktop'
    },
    startTime
  };
  
  // Override res.json to capture response data
  const originalJson = res.json;
  let responseData: any = null;
  
  res.json = function(data: any) {
    responseData = data;
    return originalJson.call(this, data);
  };
  
  // Log after response completes
  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Only log significant actions (not health checks, static assets)
      if (shouldLog(req.path, req.method, statusCode)) {
        await logAuditEvent({
          action: `${req.method} ${req.path}`,
          ip: req.ip,
          userAgent: userAgent,
          deviceFingerprint,
          geoLocation: req.geo || null,
          statusCode,
          duration,
          requestBody: sanitizeRequestBody(req.body),
          responseError: statusCode >= 400 ? responseData : null
        });
      }
      
    } catch (error) {
      logger.error('Audit logging error:', error);
    }
  });
  
  next();
};

const shouldLog = (path: string, method: string, statusCode: number): boolean => {
  // Always log authentication attempts
  if (path.includes('/auth/')) return true;
  
  // Always log file uploads
  if (path.includes('/upload')) return true;
  
  // Always log expense modifications
  if (path.includes('/expenses') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;
  
  // Always log errors
  if (statusCode >= 400) return true;
  
  // Skip health checks and static assets
  if (path === '/api/health') return false;
  if (path.includes('/static/')) return false;
  
  // Log other API calls
  if (path.startsWith('/api/')) return true;
  
  return false;
};

const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.oldPassword;
  delete sanitized.newPassword;
  delete sanitized.token;
  delete sanitized.refreshToken;
  
  return sanitized;
};

const logAuditEvent = async (event: {
  action: string;
  ip: string;
  userAgent: string;
  deviceFingerprint: string;
  geoLocation: any;
  statusCode: number;
  duration: number;
  requestBody: any;
  responseError: any;
}) => {
  try {
    await query(`
      INSERT INTO audit_logs (
        action,
        ip_address,
        user_agent,
        device_fingerprint,
        geo_location,
        details,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [
      event.action,
      event.ip,
      event.userAgent,
      event.deviceFingerprint,
      JSON.stringify(event.geoLocation),
      JSON.stringify({
        statusCode: event.statusCode,
        duration: event.duration,
        requestBody: event.requestBody,
        responseError: event.responseError
      })
    ]);
    
  } catch (error) {
    logger.error('Failed to log audit event:', error);
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      audit?: {
        deviceFingerprint: string;
        userAgent: {
          browser: string;
          version: string;
          os: string;
          device: string;
        };
        startTime: number;
      };
    }
  }
}