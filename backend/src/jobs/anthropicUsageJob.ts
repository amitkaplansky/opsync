import cron from 'node-cron';
import { AnthropicService } from '@/services/anthropicService';
import { logger } from '@/config/logger';

/**
 * Daily job to fetch Anthropic usage data
 * Runs every day at 2:00 AM to fetch previous day's usage
 */
export class AnthropicUsageJob {
  private static job: cron.ScheduledTask | null = null;

  /**
   * Start the daily Anthropic usage sync job
   */
  static start(): void {
    // Run daily at 2:00 AM
    this.job = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting daily Anthropic usage sync job...');
      
      try {
        await AnthropicService.fetchMissingSinceLastSync();
        logger.info('Daily Anthropic usage sync completed successfully');
      } catch (error) {
        logger.error('Daily Anthropic usage sync failed:', error);
        
        // In production, you might want to send alerts here
        // await AlertService.sendAlert('Anthropic Usage Sync Failed', error);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York' // Adjust to your timezone
    });

    logger.info('Anthropic usage sync job scheduled to run daily at 2:00 AM');
  }

  /**
   * Stop the scheduled job
   */
  static stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Anthropic usage sync job stopped');
    }
  }

  /**
   * Run the job manually (for testing or one-time sync)
   */
  static async runNow(): Promise<void> {
    logger.info('Running Anthropic usage sync manually...');
    
    try {
      await AnthropicService.fetchMissingSinceLastSync();
      logger.info('Manual Anthropic usage sync completed successfully');
    } catch (error) {
      logger.error('Manual Anthropic usage sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync a specific date range (for backfill or historical data)
   */
  static async syncDateRange(startDate: string, endDate: string): Promise<void> {
    logger.info(`Running Anthropic usage sync for date range: ${startDate} to ${endDate}`);
    
    try {
      await AnthropicService.syncDateRange(startDate, endDate);
      logger.info(`Anthropic usage sync for ${startDate} to ${endDate} completed successfully`);
    } catch (error) {
      logger.error(`Anthropic usage sync for ${startDate} to ${endDate} failed:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  static getStatus(): { running: boolean; nextRun?: Date } {
    if (!this.job) {
      return { running: false };
    }

    return {
      running: true,
      nextRun: this.job.nextDate()?.toDate()
    };
  }
}

// Export for use in other modules
export default AnthropicUsageJob;