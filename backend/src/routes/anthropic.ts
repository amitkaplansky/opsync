import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { logger } from '@/config/logger';
import AnthropicUsageJob from '@/jobs/anthropicUsageJob';
import { AnthropicService } from '@/services/anthropicService';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Get Anthropic job status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const status = AnthropicUsageJob.getStatus();
  
  res.json({
    success: true,
    status: {
      running: status.running,
      nextRun: status.nextRun,
      lastSync: null // TODO: Store last sync time in database
    }
  });
}));

/**
 * Manually trigger smart Anthropic usage sync (from last sync to yesterday)
 */
router.post('/sync/smart', asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  logger.info(`Manual smart Anthropic sync triggered by user ${userId}`);
  
  try {
    await AnthropicUsageJob.runNow();
    
    res.json({
      success: true,
      message: 'Anthropic smart sync completed successfully'
    });
  } catch (error) {
    logger.error('Manual Anthropic smart sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * Manually trigger Anthropic usage sync for yesterday only (legacy)
 */
router.post('/sync/yesterday', asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  logger.info(`Manual Anthropic yesterday-only sync triggered by user ${userId}`);
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    await AnthropicUsageJob.syncDateRange(dateStr, dateStr);
    
    res.json({
      success: true,
      message: `Anthropic usage sync completed for ${dateStr}`
    });
  } catch (error) {
    logger.error('Manual Anthropic yesterday sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * Sync specific date range
 */
router.post('/sync/range', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user?.userId;
  
  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'startDate and endDate are required'
    });
  }
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res.status(400).json({
      success: false,
      error: 'Dates must be in YYYY-MM-DD format'
    });
  }
  
  logger.info(`Manual Anthropic sync for ${startDate} to ${endDate} triggered by user ${userId}`);
  
  try {
    await AnthropicUsageJob.syncDateRange(startDate, endDate);
    
    res.json({
      success: true,
      message: `Anthropic usage sync completed for ${startDate} to ${endDate}`
    });
  } catch (error) {
    logger.error(`Anthropic sync failed for ${startDate} to ${endDate}:`, error);
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * Upload and process CSV export from Anthropic dashboard
 * This is an alternative if the API doesn't work
 */
router.post('/upload-csv', asyncHandler(async (req, res) => {
  const { csvContent } = req.body;
  const userId = req.user?.userId;
  
  if (!csvContent) {
    return res.status(400).json({
      success: false,
      error: 'csvContent is required'
    });
  }
  
  logger.info(`Anthropic CSV upload triggered by user ${userId}`);
  
  try {
    const usage = await AnthropicService.parseCsvExport(csvContent);
    await AnthropicService.storeUsageAsExpenses(usage);
    
    res.json({
      success: true,
      message: `Processed ${usage.length} usage records from CSV`,
      recordsProcessed: usage.length
    });
  } catch (error) {
    logger.error('Anthropic CSV processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'CSV processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * Test Anthropic API connection
 */
router.get('/test-connection', asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  logger.info(`Anthropic API connection test triggered by user ${userId}`);
  
  try {
    // Try to fetch yesterday's data as a test
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    const usageData = await AnthropicService.fetchUsageData(dateStr, dateStr);
    
    res.json({
      success: true,
      message: 'Anthropic API connection successful',
      testDate: dateStr,
      hasData: !!(usageData && usageData.usage && usageData.usage.length > 0)
    });
  } catch (error) {
    logger.error('Anthropic API connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'API connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;