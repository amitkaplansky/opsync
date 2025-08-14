import { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message } = error;
  
  // Log the error
  logger.error('Application error:', {
    error: message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Database connection errors
  if (error.message?.includes('connect ECONNREFUSED')) {
    statusCode = 503;
    message = 'Service temporarily unavailable';
  }
  
  // Redis connection errors
  if (error.message?.includes('Redis')) {
    statusCode = 503;
    message = 'Cache service unavailable';
  }
  
  // JWT errors
  if (error.message?.includes('jwt')) {
    statusCode = 401;
    message = 'Invalid or expired token';
  }
  
  // Validation errors
  if (error.message?.includes('ValidationError')) {
    statusCode = 400;
    message = 'Invalid input data';
  }
  
  // File upload errors
  if (error.message?.includes('LIMIT_FILE_SIZE')) {
    statusCode = 413;
    message = 'File too large';
  }
  
  // Rate limiting errors
  if (error.message?.includes('Too many requests')) {
    statusCode = 429;
    message = 'Rate limit exceeded';
  }
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error 
    })
  });
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};