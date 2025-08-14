import { Router } from 'express';
import { ExpenseModel } from '@/models/Expense';
import { AuditLogModel } from '@/models/AuditLog';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { DashboardStats } from '@/types';

const router = Router();

// All dashboard routes require authentication
router.use(authenticateToken);

// Get dashboard overview stats
router.get('/overview', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  
  const stats = await ExpenseModel.getStats(userId);
  const trendData = await ExpenseModel.getMonthlyTrend(userId, 6);
  
  // Calculate top providers with percentages (show all sensitivity levels)
  const topProviders = stats.topProviders.slice(0, 5).map((provider: any) => ({
    name: provider.name.length > 25 ? provider.name.substring(0, 25) + '...' : provider.name,
    percentage: stats.totalAmount > 0 ? (provider.total / stats.totalAmount * 100).toFixed(1) : '0',
    masked: false // Remove masking - show all providers
  }));
  
  const dashboardStats: DashboardStats = {
    totalExpenses: stats.totalExpenses,
    monthlyTotal: stats.monthlyTotal,
    monthlyChange: stats.monthlyChange,
    topProviders,
    recentTransactions: stats.monthlyCount
  };
  
  res.json({
    ...dashboardStats,
    trendData: trendData.map(item => ({
      month: item.month,
      total: item.total,
      count: item.count
    }))
  });
}));

// Get recent activity summary
router.get('/activity', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const hours = parseInt(req.query.hours as string) || 24;
  
  const recentLogs = await AuditLogModel.findByUser(userId, 20);
  const recentExpenses = await ExpenseModel.findAll(userId, {
    startDate: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  
  const activity = {
    recentActions: recentLogs.slice(0, 10).map(log => ({
      action: log.action,
      timestamp: log.timestamp,
      details: log.details
    })),
    recentExpenses: recentExpenses.slice(0, 5).map(expense => ({
      id: expense.id,
      provider: expense.provider_name, // Show actual provider names for all sensitivity levels
      amount: expense.amount,
      date: expense.date,
      masked: false // Remove masking
    }))
  };
  
  res.json(activity);
}));

// Get security summary
router.get('/security', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  
  const securityEvents = await AuditLogModel.getSecurityEvents(10);
  const userSecurityEvents = securityEvents.filter(event => event.user_id === userId);
  
  const suspiciousActivities = await AuditLogModel.getSuspiciousActivities(24);
  
  const securitySummary = {
    recentSecurityEvents: userSecurityEvents.slice(0, 5).map(event => ({
      action: event.action,
      timestamp: event.timestamp,
      ipAddress: event.ip_address,
      success: event.action.includes('SUCCESS')
    })),
    systemAlerts: suspiciousActivities.length,
    lastLogin: userSecurityEvents.find(e => e.action === 'LOGIN_SUCCESS')?.timestamp,
    accountStatus: 'active' // Could be enhanced with more logic
  };
  
  res.json(securitySummary);
}));

// Get data retention summary
router.get('/retention', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  
  // Get retention information for user's data (includes API-generated expenses)
  const userExpenses = await ExpenseModel.findAll(userId);
  
  const retentionSummary = {
    totalRecords: userExpenses.length,
    permanentRetention: userExpenses.filter(e => !e.retention_until).length,
    temporaryRetention: userExpenses.filter(e => e.retention_until && new Date(e.retention_until) > new Date()).length,
    expiringSoon: userExpenses.filter(e => {
      if (!e.retention_until) return false;
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return new Date(e.retention_until) <= thirtyDaysFromNow;
    }).length,
    dataMinimization: {
      highSensitivity: userExpenses.filter(e => e.sensitivity_level === 'HIGH').length,
      maskedProviders: userExpenses.filter(e => e.provider_masked_name && e.provider_masked_name !== e.provider_name).length
    }
  };
  
  res.json(retentionSummary);
}));


export default router;