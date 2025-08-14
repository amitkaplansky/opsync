import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { query } from '@/config/database';
import { setWithExpiry, del } from '@/config/redis';
import { logger } from '@/config/logger';
import { User, LoginRequest, LoginResponse } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  
  static async login(
    loginData: LoginRequest,
    ip: string,
    userAgent: string,
    deviceFingerprint: string,
    geoLocation?: any
  ): Promise<LoginResponse> {
    const { username, password } = loginData;
    
    try {
      // Get user
      const userResult = await query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      if (userResult.rows.length === 0) {
        await this.logFailedAttempt(username, ip, 'user_not_found');
        throw new Error('Invalid credentials');
      }
      
      const user: User = userResult.rows[0];
      
      // Check if account is locked
      if (user.account_locked_until && new Date() < user.account_locked_until) {
        await this.logFailedAttempt(username, ip, 'account_locked');
        throw new Error('Account temporarily locked');
      }
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        await this.handleFailedLogin(user);
        await this.logFailedAttempt(username, ip, 'invalid_password');
        throw new Error('Invalid credentials');
      }
      
      // Check if user is active
      if (!user.is_active) {
        await this.logFailedAttempt(username, ip, 'user_inactive');
        throw new Error('Account deactivated');
      }
      
      // Clear failed attempts on successful login
      await this.clearFailedAttempts(user.id);
      
      // Generate tokens
      const { token, refreshToken } = await this.generateTokens(user.id);
      
      // Create session
      await this.createSession({
        userId: user.id,
        refreshToken,
        deviceFingerprint,
        ip,
        userAgent,
        geoLocation
      });
      
      // Update last login
      await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      // Log successful login
      await this.logSuccessfulLogin(user.id, ip);
      
      return {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      };
      
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }
  
  static async refreshToken(refreshToken: string, ip: string): Promise<LoginResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      
      // Check if session exists
      const sessionResult = await query(
        'SELECT user_id FROM sessions WHERE refresh_token_hash = $1 AND expires_at > CURRENT_TIMESTAMP',
        [this.hashRefreshToken(refreshToken)]
      );
      
      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }
      
      const userId = sessionResult.rows[0].user_id;
      
      // Get user
      const userResult = await query(
        'SELECT id, username, is_active FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        throw new Error('User not found or inactive');
      }
      
      const user = userResult.rows[0];
      
      // Generate new access token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      // Update session last accessed
      await query(
        'UPDATE sessions SET last_accessed = CURRENT_TIMESTAMP WHERE refresh_token_hash = $1',
        [this.hashRefreshToken(refreshToken)]
      );
      
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
      logger.error('Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }
  
  static async logout(userId: number, refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        // Delete specific session
        await query(
          'DELETE FROM sessions WHERE user_id = $1 AND refresh_token_hash = $2',
          [userId, this.hashRefreshToken(refreshToken)]
        );
      } else {
        // Delete all sessions for user
        await query(
          'DELETE FROM sessions WHERE user_id = $1',
          [userId]
        );
      }
      
      logger.info(`User ${userId} logged out`);
      
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }
  
  private static async generateTokens(userId: number) {
    const token = jwt.sign(
      { userId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
    
    return { token, refreshToken };
  }
  
  private static async createSession({
    userId,
    refreshToken,
    deviceFingerprint,
    ip,
    userAgent,
    geoLocation
  }: {
    userId: number;
    refreshToken: string;
    deviceFingerprint: string;
    ip: string;
    userAgent: string;
    geoLocation?: any;
  }) {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await query(
      `INSERT INTO sessions 
       (user_id, session_token, refresh_token_hash, device_fingerprint, ip_address, user_agent, geo_location, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        randomBytes(32).toString('hex'),
        refreshTokenHash,
        deviceFingerprint,
        ip,
        userAgent,
        JSON.stringify(geoLocation),
        expiresAt
      ]
    );
  }
  
  private static hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
  
  private static async handleFailedLogin(user: User) {
    const newAttempts = user.failed_login_attempts + 1;
    let lockoutUntil = null;
    
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION);
    }
    
    await query(
      'UPDATE users SET failed_login_attempts = $1, account_locked_until = $2 WHERE id = $3',
      [newAttempts, lockoutUntil, user.id]
    );
  }
  
  private static async clearFailedAttempts(userId: number) {
    await query(
      'UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1',
      [userId]
    );
  }
  
  private static async logFailedAttempt(username: string, ip: string, reason: string) {
    await query(
      `INSERT INTO audit_logs (action, details, ip_address, timestamp)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [
        'LOGIN_FAILED',
        JSON.stringify({ username, reason }),
        ip
      ]
    );
  }
  
  private static async logSuccessfulLogin(userId: number, ip: string) {
    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address, timestamp)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [userId, 'LOGIN_SUCCESS', ip]
    );
  }
}