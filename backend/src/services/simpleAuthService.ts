import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { User, LoginRequest, LoginResponse } from '@/types';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Ensure .env is loaded
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const JWT_SECRET = process.env.JWT_SECRET!;
const MAX_LOGIN_ATTEMPTS = 5;

export class SimpleAuthService {
  
  static async login(
    loginData: LoginRequest,
    ip: string
  ): Promise<LoginResponse> {
    const { username, password } = loginData;
    
    try {
      logger.info(`Login attempt for user: ${username} from IP: ${ip}`);
      
      // Get user
      const userResult = await query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
      );
      
      if (userResult.rows.length === 0) {
        logger.warn(`Login failed - user not found: ${username}`);
        throw new Error('Invalid credentials');
      }
      
      const user: User = userResult.rows[0];
      
      // Check if account is locked
      if (user.account_locked_until && new Date() < user.account_locked_until) {
        logger.warn(`Login failed - account locked: ${username}`);
        throw new Error('Account temporarily locked');
      }
      
      // Check password with timeout
      const isValidPassword = await Promise.race([
        bcrypt.compare(password, user.password_hash),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Password check timeout')), 5000)
        )
      ]);
      
      if (!isValidPassword) {
        // Update failed attempts
        await query(
          'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
          [user.id]
        );
        
        logger.warn(`Login failed - invalid password: ${username}`);
        throw new Error('Invalid credentials');
      }
      
      // Clear failed attempts on successful login
      await query(
        'UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      // Generate simple JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        },
        JWT_SECRET
      );
      
      // Create session record for auth middleware
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await query(
        `INSERT INTO sessions 
         (user_id, session_token, refresh_token_hash, device_fingerprint, ip_address, user_agent, expires_at, created_at, last_accessed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          user.id,
          'simple-' + Date.now(), // Simple session token
          'simple-refresh-' + Date.now(), // Simple refresh token hash
          'simple-device', // Device fingerprint
          ip,
          'Simple Auth Service',
          expiresAt
        ]
      );
      
      // Log successful login
      await query(
        `INSERT INTO audit_logs (user_id, action, ip_address, timestamp)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [user.id, 'LOGIN_SUCCESS', ip]
      );
      
      logger.info(`Login successful for user: ${username}`);
      
      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      };
      
    } catch (error) {
      // Log failed attempt
      try {
        await query(
          `INSERT INTO audit_logs (action, details, ip_address, timestamp)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [
            'LOGIN_FAILED',
            JSON.stringify({ username, error: error instanceof Error ? error.message : 'Unknown error' }),
            ip
          ]
        );
      } catch (logError) {
        logger.error('Failed to log failed login attempt:', logError);
      }
      
      logger.error(`Login error for ${username}:`, error);
      throw error;
    }
  }
  
  static async logout(userId: number): Promise<void> {
    try {
      // For demo mode, just log without database insert
      if (userId === 1) {
        logger.info(`Demo user logged out`);
        return;
      }
      
      await query(
        `INSERT INTO audit_logs (user_id, action, timestamp)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [userId, 'LOGOUT']
      );
      
      logger.info(`User ${userId} logged out`);
      
    } catch (error) {
      logger.error('Logout error:', error);
    }
  }
}