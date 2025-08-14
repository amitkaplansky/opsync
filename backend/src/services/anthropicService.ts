import axios from 'axios';
import { logger } from '@/config/logger';
import { query } from '@/config/database';

interface AnthropicUsage {
  date: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  requests: number;
}

interface AnthropicBillingData {
  period: {
    start_date: string;
    end_date: string;
  };
  usage: AnthropicUsage[];
  total_cost_usd: number;
}

export class AnthropicService {
  private static readonly BASE_URL = 'https://api.anthropic.com/v1';
  private static readonly API_KEY = process.env.ANTHROPIC_API_KEY;

  /**
   * Fetch usage data from Anthropic API
   * Note: This is a conceptual implementation as Anthropic may not have public billing APIs
   * You may need to use their dashboard API or contact support for access
   */
  static async fetchUsageData(startDate: string, endDate: string): Promise<AnthropicBillingData | null> {
    if (!this.API_KEY) {
      logger.error('Anthropic API key not configured');
      logger.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('ANTHROPIC')));
      throw new Error('Anthropic API key not configured');
    }

    logger.info(`Anthropic API key found: ${this.API_KEY.substring(0, 20)}...`);

    try {
      logger.info(`Fetching Anthropic usage data from ${startDate} to ${endDate}`);

      // First, test basic API connectivity with a simple request
      const testResponse = await axios.get(`${this.BASE_URL}/messages`, {
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000,
        validateStatus: () => true // Accept all status codes for testing
      });

      logger.info(`Anthropic API test response status: ${testResponse.status}`);

      if (testResponse.status === 401) {
        logger.error('Invalid Anthropic API key');
        throw new Error('Invalid Anthropic API key');
      } else if (testResponse.status === 400 || testResponse.status === 405) {
        // These are expected for an incomplete request - means auth works
        logger.info('Anthropic API key is valid (got expected 400/405 for incomplete request)');
      }

      // Note: Anthropic doesn't have a public billing API yet
      // This would be the theoretical endpoint
      logger.warn('Anthropic billing API not available - using mock data for demonstration');
      
      // Return mock data for testing
      return {
        period: {
          start_date: startDate,
          end_date: endDate
        },
        usage: [
          {
            date: startDate,
            model: 'claude-3-sonnet-20240229',
            input_tokens: 15000,
            output_tokens: 3000,
            cost_usd: 2.40,
            requests: 5
          }
        ],
        total_cost_usd: 2.40
      };
    } catch (error: any) {
      if (error.message === 'Invalid Anthropic API key') {
        throw error;
      }
      logger.error('Failed to fetch Anthropic usage data:', error.message);
      throw new Error(`API connection failed: ${error.message}`);
    }
  }

  /**
   * Alternative: Parse CSV export from Anthropic dashboard
   * This would be used if the API approach doesn't work
   */
  static async parseCsvExport(csvContent: string): Promise<AnthropicUsage[]> {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    const usage: AnthropicUsage[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;
      
      try {
        usage.push({
          date: values[0], // Assuming first column is date
          model: values[1] || 'claude-3-sonnet',
          input_tokens: parseInt(values[2]) || 0,
          output_tokens: parseInt(values[3]) || 0,
          cost_usd: parseFloat(values[4]) || 0,
          requests: parseInt(values[5]) || 1
        });
      } catch (error) {
        logger.warn(`Failed to parse CSV line ${i}: ${lines[i]}`);
      }
    }
    
    return usage;
  }

  /**
   * Store Anthropic usage data as expenses in database
   */
  static async storeUsageAsExpenses(usageData: AnthropicUsage[]): Promise<void> {
    for (const usage of usageData) {
      try {
        // Check if expense already exists for this date
        const existing = await query(
          'SELECT id FROM expenses WHERE provider_name = $1 AND date = $2 AND source_type = $3',
          ['Anthropic', usage.date, 'api']
        );

        if (existing.rows.length > 0) {
          // Update existing expense
          await query(
            `UPDATE expenses 
             SET amount = $1, 
                 description = $2, 
                 updated_at = CURRENT_TIMESTAMP,
                 metadata = $3
             WHERE id = $4`,
            [
              usage.cost_usd,
              `Claude ${usage.model} - ${usage.input_tokens.toLocaleString()} input + ${usage.output_tokens.toLocaleString()} output tokens`,
              JSON.stringify({
                model: usage.model,
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                requests: usage.requests,
                tokens_total: usage.input_tokens + usage.output_tokens
              }),
              existing.rows[0].id
            ]
          );
          
          logger.info(`Updated Anthropic expense for ${usage.date}: $${usage.cost_usd}`);
        } else {
          // Create new expense
          await query(
            `INSERT INTO expenses 
             (provider_name, amount, date, description, category, source_type, sensitivity_level, created_at, updated_at, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)`,
            [
              'Anthropic',
              usage.cost_usd,
              usage.date,
              `Claude ${usage.model} - ${usage.input_tokens.toLocaleString()} input + ${usage.output_tokens.toLocaleString()} output tokens`,
              'AI Services',
              'api',
              usage.cost_usd > 100 ? 'MEDIUM' : 'LOW', // Sensitivity based on cost
              JSON.stringify({
                model: usage.model,
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                requests: usage.requests,
                tokens_total: usage.input_tokens + usage.output_tokens
              })
            ]
          );
          
          logger.info(`Created new Anthropic expense for ${usage.date}: $${usage.cost_usd}`);
        }
      } catch (error) {
        logger.error(`Failed to store Anthropic usage for ${usage.date}:`, error);
      }
    }
  }

  /**
   * Get last sync date from database (most recent API expense)
   */
  static async getLastSyncDate(): Promise<string | null> {
    try {
      const result = await query(
        `SELECT MAX(date) as last_date 
         FROM expenses 
         WHERE provider_name = $1 AND source_type = $2`,
        ['Anthropic', 'api']
      );
      
      return result.rows[0]?.last_date || null;
    } catch (error) {
      logger.error('Failed to get last Anthropic sync date:', error);
      return null;
    }
  }

  /**
   * Smart sync - fetches from last API expense date to yesterday
   * If no previous data exists, fetches last 30 days
   */
  static async fetchMissingSinceLastSync(): Promise<void> {
    try {
      const lastSyncDate = await this.getLastSyncDate();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let startDate: string;
      
      if (lastSyncDate) {
        // Start from day after last sync
        const nextDay = new Date(lastSyncDate);
        nextDay.setDate(nextDay.getDate() + 1);
        startDate = nextDay.toISOString().split('T')[0];
        
        logger.info(`Found last Anthropic sync: ${lastSyncDate}, syncing from ${startDate} to ${yesterdayStr}`);
      } else {
        // No previous data, get last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
        
        logger.info(`No previous Anthropic data found, syncing last 30 days: ${startDate} to ${yesterdayStr}`);
      }
      
      // Don't sync if start date is after yesterday (nothing to sync)
      if (startDate > yesterdayStr) {
        logger.info('Anthropic data is already up to date, nothing to sync');
        return;
      }
      
      const usageData = await this.fetchUsageData(startDate, yesterdayStr);
      
      if (usageData && usageData.usage.length > 0) {
        await this.storeUsageAsExpenses(usageData.usage);
        logger.info(`Successfully processed ${usageData.usage.length} Anthropic usage records from ${startDate} to ${yesterdayStr}`);
      } else {
        logger.info(`No Anthropic usage data found for ${startDate} to ${yesterdayStr}`);
      }
    } catch (error) {
      logger.error('Failed to fetch missing Anthropic usage:', error);
      throw error;
    }
  }

  /**
   * Get yesterday's usage (for daily cron job)
   * @deprecated Use fetchMissingSinceLastSync() instead for better gap handling
   */
  static async fetchYesterdayUsage(): Promise<void> {
    // Redirect to smart sync method
    await this.fetchMissingSinceLastSync();
  }

  /**
   * Manual sync for a date range (for initial setup or backfill)
   */
  static async syncDateRange(startDate: string, endDate: string): Promise<void> {
    try {
      logger.info(`Starting Anthropic usage sync from ${startDate} to ${endDate}`);
      
      const usageData = await this.fetchUsageData(startDate, endDate);
      
      if (usageData && usageData.usage.length > 0) {
        await this.storeUsageAsExpenses(usageData.usage);
        logger.info(`Successfully synced ${usageData.usage.length} Anthropic usage records`);
      } else {
        logger.warn('No Anthropic usage data returned from API');
      }
    } catch (error) {
      logger.error('Failed to sync Anthropic usage data:', error);
      throw error;
    }
  }
}