import { query } from '@/config/database';
import { Expense, ExpenseCreateRequest, ExpenseUpdateRequest } from '@/types';

export class ExpenseModel {
  
  static async findAll(
    userId: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      provider?: string;
      category?: string;
      minAmount?: number;
      maxAmount?: number;
      showMasked?: boolean;
    }
  ): Promise<Expense[]> {
    let whereClause = 'WHERE (created_by = $1 OR created_by IS NULL)';
    const params: any[] = [userId];
    let paramCount = 1;
    
    if (filters?.startDate) {
      whereClause += ` AND date >= $${++paramCount}`;
      params.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      whereClause += ` AND date <= $${++paramCount}`;
      params.push(filters.endDate);
    }
    
    if (filters?.provider) {
      whereClause += ` AND (provider_name ILIKE $${++paramCount} OR provider_masked_name ILIKE $${paramCount})`;
      params.push(`%${filters.provider}%`);
    }
    
    if (filters?.category) {
      whereClause += ` AND category = $${++paramCount}`;
      params.push(filters.category);
    }
    
    if (filters?.minAmount) {
      whereClause += ` AND amount >= $${++paramCount}`;
      params.push(filters.minAmount);
    }
    
    if (filters?.maxAmount) {
      whereClause += ` AND amount <= $${++paramCount}`;
      params.push(filters.maxAmount);
    }
    
    const selectFields = filters?.showMasked 
      ? '*' 
      : `id, 
         provider_name,
         provider_masked_name,
         description, amount, currency, date, due_date, source_type, 
         sensitivity_level, tags, category, file_id, created_by, 
         created_at, updated_at, retention_until, metadata, file_retention_policy`;
    
    const result = await query(
      `SELECT ${selectFields} FROM expenses ${whereClause} ORDER BY date DESC`,
      params
    );
    
    return result.rows;
  }
  
  static async findById(id: number, userId: number): Promise<Expense | null> {
    const result = await query(
      'SELECT * FROM expenses WHERE id = $1 AND (created_by = $2 OR created_by IS NULL)',
      [id, userId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  static async create(data: ExpenseCreateRequest, userId: number): Promise<Expense> {
    // Determine sensitivity level based on provider name
    const sensitivityResult = await query(
      'SELECT get_provider_sensitivity($1) as sensitivity',
      [data.provider_name]
    );
    
    const sensitivityLevel = sensitivityResult.rows[0]?.sensitivity || 'LOW';
    
    const result = await query(
      `INSERT INTO expenses (
        provider_name, description, amount, currency, date, due_date,
        source_type, sensitivity_level, tags, category, created_by,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.provider_name,
        data.description,
        data.amount,
        data.currency || 'USD',
        data.date,
        data.due_date || null,
        'manual',
        sensitivityLevel,
        data.tags || [],
        data.category,
        userId
      ]
    );
    
    return result.rows[0];
  }
  
  static async update(id: number, data: ExpenseUpdateRequest, userId: number): Promise<Expense | null> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    if (data.description !== undefined) {
      fields.push(`description = $${++paramCount}`);
      params.push(data.description);
    }
    
    if (data.amount !== undefined) {
      fields.push(`amount = $${++paramCount}`);
      params.push(data.amount);
    }
    
    if (data.currency !== undefined) {
      fields.push(`currency = $${++paramCount}`);
      params.push(data.currency);
    }
    
    if (data.tags !== undefined) {
      fields.push(`tags = $${++paramCount}`);
      params.push(data.tags);
    }
    
    if (data.category !== undefined) {
      fields.push(`category = $${++paramCount}`);
      params.push(data.category);
    }
    
    if (data.due_date !== undefined) {
      fields.push(`due_date = $${++paramCount}`);
      params.push(data.due_date);
    }
    
    if (data.provider_name !== undefined) {
      fields.push(`provider_name = $${++paramCount}`);
      params.push(data.provider_name);
    }
    
    if (data.sensitivity_level !== undefined) {
      fields.push(`sensitivity_level = $${++paramCount}`);
      params.push(data.sensitivity_level);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, userId);
    
    const result = await query(
      `UPDATE expenses SET ${fields.join(', ')} 
       WHERE id = $${++paramCount} AND (created_by = $${++paramCount} OR created_by IS NULL)
       RETURNING *`,
      params
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  static async delete(id: number, userId: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND (created_by = $2 OR created_by IS NULL)',
      [id, userId]
    );
    
    return result.rowCount! > 0;
  }
  
  static async getStats(userId: number): Promise<any> {
    const results = await Promise.all([
      // Total expenses (include user's expenses and API-generated ones)
      query(
        'SELECT COUNT(*) as total, SUM(amount) as total_amount FROM expenses WHERE (created_by = $1 OR created_by IS NULL)',
        [userId]
      ),
      
      // Monthly stats (include user's expenses and API-generated ones)
      query(
        `SELECT 
           COUNT(*) as monthly_count,
           SUM(amount) as monthly_total
         FROM expenses 
         WHERE (created_by = $1 OR created_by IS NULL)
           AND date >= date_trunc('month', CURRENT_DATE)`,
        [userId]
      ),
      
      // Previous month for comparison (include user's expenses and API-generated ones)
      query(
        `SELECT SUM(amount) as prev_monthly_total
         FROM expenses 
         WHERE (created_by = $1 OR created_by IS NULL)
           AND date >= date_trunc('month', CURRENT_DATE - interval '1 month')
           AND date < date_trunc('month', CURRENT_DATE)`,
        [userId]
      ),
      
      // Top providers (include ALL sensitivity levels and API-generated expenses)
      query(
        `SELECT 
           provider_name as provider,
           SUM(amount) as total,
           COUNT(*) as count,
           MAX(sensitivity_level) as max_sensitivity,
           false as is_masked
         FROM expenses 
         WHERE (created_by = $1 OR created_by IS NULL)
         GROUP BY provider_name
         ORDER BY total DESC 
         LIMIT 5`,
        [userId]
      )
    ]);
    
    const totalStats = results[0].rows[0];
    const monthlyStats = results[1].rows[0];
    const prevMonthStats = results[2].rows[0];
    const topProviders = results[3].rows;
    
    const monthlyChange = prevMonthStats.prev_monthly_total 
      ? ((monthlyStats.monthly_total - prevMonthStats.prev_monthly_total) / prevMonthStats.prev_monthly_total) * 100
      : 0;
    
    return {
      totalExpenses: parseInt(totalStats.total),
      totalAmount: parseFloat(totalStats.total_amount || 0),
      monthlyTotal: parseFloat(monthlyStats.monthly_total || 0),
      monthlyCount: parseInt(monthlyStats.monthly_count),
      monthlyChange: parseFloat(monthlyChange.toFixed(2)),
      topProviders: topProviders.map(p => ({
        name: p.provider,
        total: parseFloat(p.total),
        count: parseInt(p.count),
        masked: p.is_masked
      }))
    };
  }
  
  static async getMonthlyTrend(userId: number, months: number = 12): Promise<any[]> {
    const result = await query(
      `SELECT 
         date_trunc('month', date) as month,
         SUM(amount) as total,
         COUNT(*) as count
       FROM expenses 
       WHERE (created_by = $1 OR created_by IS NULL)
         AND date >= CURRENT_DATE - interval '${months} months'
       GROUP BY month
       ORDER BY month`,
      [userId]
    );
    
    return result.rows.map(row => ({
      month: row.month,
      total: parseFloat(row.total),
      count: parseInt(row.count)
    }));
  }
}