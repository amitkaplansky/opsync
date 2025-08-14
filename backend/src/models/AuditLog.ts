import { query } from '@/config/database';
import { AuditLog } from '@/types';

export class AuditLogModel {
  
  static async create(data: {
    userId?: number;
    action: string;
    resourceType?: string;
    resourceId?: number;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    geoLocation?: any;
  }): Promise<AuditLog> {
    const result = await query(
      `INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, details,
        ip_address, user_agent, device_fingerprint, geo_location, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.userId,
        data.action,
        data.resourceType,
        data.resourceId,
        JSON.stringify(data.details),
        data.ipAddress,
        data.userAgent,
        data.deviceFingerprint,
        JSON.stringify(data.geoLocation)
      ]
    );
    
    return result.rows[0];
  }
  
  static async findByUser(
    userId: number, 
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    return result.rows;
  }
  
  static async findByAction(
    action: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE action = $1 
       ORDER BY timestamp DESC 
       LIMIT $2 OFFSET $3`,
      [action, limit, offset]
    );
    
    return result.rows;
  }
  
  static async findRecent(
    hours: number = 24,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE timestamp >= CURRENT_TIMESTAMP - interval '${hours} hours'
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }
  
  static async findByResource(
    resourceType: string,
    resourceId: number
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE resource_type = $1 AND resource_id = $2 
       ORDER BY timestamp DESC`,
      [resourceType, resourceId]
    );
    
    return result.rows;
  }
  
  static async getSecurityEvents(
    limit: number = 50
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE action IN (
         'LOGIN_FAILED', 'LOGIN_SUCCESS', 'LOGOUT', 
         'ACCOUNT_LOCKED', 'PASSWORD_CHANGE',
         'SENSITIVE_DATA_ACCESS', 'FILE_UPLOAD',
         'DATA_EXPORT', 'ADMIN_ACTION'
       )
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }
  
  static async getFailedLoginsByIP(
    ipAddress: string,
    hours: number = 1
  ): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'LOGIN_FAILED' 
         AND ip_address = $1 
         AND timestamp >= CURRENT_TIMESTAMP - interval '${hours} hours'`,
      [ipAddress]
    );
    
    return parseInt(result.rows[0].count);
  }
  
  static async getSuspiciousActivities(
    hours: number = 24
  ): Promise<any[]> {
    const result = await query(
      `SELECT 
         ip_address,
         COUNT(*) as failed_attempts,
         COUNT(DISTINCT user_id) as users_targeted,
         MIN(timestamp) as first_attempt,
         MAX(timestamp) as last_attempt
       FROM audit_logs 
       WHERE action = 'LOGIN_FAILED' 
         AND timestamp >= CURRENT_TIMESTAMP - interval '${hours} hours'
       GROUP BY ip_address
       HAVING COUNT(*) >= 3
       ORDER BY failed_attempts DESC`,
      []
    );
    
    return result.rows;
  }
  
  static async cleanupOldLogs(retentionDays: number = 2555): Promise<number> {
    const result = await query(
      `DELETE FROM audit_logs 
       WHERE timestamp < CURRENT_TIMESTAMP - interval '${retentionDays} days'`,
      []
    );
    
    return result.rowCount || 0;
  }
}