import { query } from '@/config/database';
import { FileRecord } from '@/types';

export class FileModel {
  
  static async create(data: {
    originalFilename: string;
    encryptedFilename: string;
    fileSize: number;
    mimeType: string;
    encryptionKeyHash: string;
    sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    retentionPolicy: 'immediate' | 'temporary' | 'permanent';
    uploadedBy: number;
    expiresAt?: Date;
  }): Promise<FileRecord> {
    const result = await query(
      `INSERT INTO files (
        original_filename, encrypted_filename, file_size, mime_type,
        encryption_key_hash, sensitivity_level, retention_policy,
        uploaded_by, uploaded_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)
      RETURNING *`,
      [
        data.originalFilename,
        data.encryptedFilename,
        data.fileSize,
        data.mimeType,
        data.encryptionKeyHash,
        data.sensitivityLevel,
        data.retentionPolicy,
        data.uploadedBy,
        data.expiresAt
      ]
    );
    
    return result.rows[0];
  }
  
  static async findById(id: number): Promise<FileRecord | null> {
    const result = await query(
      'SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  static async findByUser(userId: number): Promise<FileRecord[]> {
    const result = await query(
      `SELECT * FROM files 
       WHERE uploaded_by = $1 AND deleted_at IS NULL 
       ORDER BY uploaded_at DESC`,
      [userId]
    );
    
    return result.rows;
  }
  
  static async updateOCRText(id: number, ocrText: string): Promise<void> {
    await query(
      'UPDATE files SET ocr_extracted_text = $1, processing_status = $2 WHERE id = $3',
      [ocrText, 'completed', id]
    );
  }
  
  static async updateProcessingStatus(id: number, status: string): Promise<void> {
    await query(
      'UPDATE files SET processing_status = $1 WHERE id = $2',
      [status, id]
    );
  }
  
  static async markAsDeleted(id: number): Promise<void> {
    await query(
      'UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }
  
  static async findExpiredFiles(): Promise<FileRecord[]> {
    const result = await query(
      `SELECT * FROM files 
       WHERE expires_at IS NOT NULL 
         AND expires_at <= CURRENT_TIMESTAMP 
         AND deleted_at IS NULL`,
      []
    );
    
    return result.rows;
  }
  
  static async findFilesForDeletion(): Promise<FileRecord[]> {
    const result = await query(
      `SELECT * FROM files 
       WHERE retention_policy = 'immediate' 
         AND processing_status = 'completed'
         AND uploaded_at <= CURRENT_TIMESTAMP - interval '1 hour'
         AND deleted_at IS NULL`,
      []
    );
    
    return result.rows;
  }
  
  static async getFileStats(userId?: number): Promise<any> {
    const whereClause = userId ? 'WHERE uploaded_by = $1' : '';
    const params = userId ? [userId] : [];
    
    const result = await query(
      `SELECT 
         COUNT(*) as total_files,
         SUM(file_size) as total_size,
         COUNT(CASE WHEN retention_policy = 'immediate' THEN 1 END) as immediate_deletion,
         COUNT(CASE WHEN retention_policy = 'temporary' THEN 1 END) as temporary_retention,
         COUNT(CASE WHEN retention_policy = 'permanent' THEN 1 END) as permanent_retention,
         COUNT(CASE WHEN sensitivity_level = 'HIGH' THEN 1 END) as high_sensitivity,
         COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending_processing
       FROM files 
       ${whereClause} AND deleted_at IS NULL`,
      params
    );
    
    return result.rows[0];
  }
  
  static async cleanupExpiredFiles(): Promise<number> {
    const expiredFiles = await this.findExpiredFiles();
    let deletedCount = 0;
    
    for (const file of expiredFiles) {
      await this.markAsDeleted(file.id);
      deletedCount++;
    }
    
    return deletedCount;
  }
  
  static async getRetentionSummary(): Promise<any[]> {
    const result = await query(
      `SELECT 
         retention_policy,
         sensitivity_level,
         COUNT(*) as file_count,
         SUM(file_size) as total_size,
         MIN(uploaded_at) as oldest_file,
         MAX(uploaded_at) as newest_file
       FROM files 
       WHERE deleted_at IS NULL
       GROUP BY retention_policy, sensitivity_level
       ORDER BY retention_policy, sensitivity_level`,
      []
    );
    
    return result.rows;
  }
}