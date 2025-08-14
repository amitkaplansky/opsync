import { query } from '@/config/database';
import { User } from '@/types';

export class UserModel {
  
  static async findById(id: number): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  static async findByUsername(username: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  static async findActiveUsers(): Promise<User[]> {
    const result = await query(
      'SELECT id, username, last_login, created_at FROM users WHERE is_active = true ORDER BY username'
    );
    
    return result.rows;
  }
  
  static async updateLastLogin(id: number): Promise<void> {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }
  
  static async incrementFailedAttempts(id: number): Promise<void> {
    await query(
      'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
      [id]
    );
  }
  
  static async resetFailedAttempts(id: number): Promise<void> {
    await query(
      'UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1',
      [id]
    );
  }
  
  static async lockAccount(id: number, lockUntil: Date): Promise<void> {
    await query(
      'UPDATE users SET account_locked_until = $1 WHERE id = $2',
      [lockUntil, id]
    );
  }
  
  static async isAccountLocked(id: number): Promise<boolean> {
    const result = await query(
      'SELECT account_locked_until FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return false;
    
    const lockUntil = result.rows[0].account_locked_until;
    return lockUntil && new Date() < new Date(lockUntil);
  }
}