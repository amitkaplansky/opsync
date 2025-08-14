import { Router } from 'express';
import { ExpenseModel } from '@/models/Expense';
import { AuditLogModel } from '@/models/AuditLog';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { ExpenseCreateRequest, ExpenseUpdateRequest } from '@/types';
import { AntivirusService } from '@/services/antivirusService';

const router = Router();

// All expense routes require authentication
router.use(authenticateToken);

// Get all expenses with filtering
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const {
    startDate,
    endDate,
    provider,
    category,
    minAmount,
    maxAmount,
    showMasked
  } = req.query;
  
  const filters = {
    startDate: startDate as string,
    endDate: endDate as string,
    provider: provider as string,
    category: category as string,
    minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
    showMasked: showMasked === 'true'
  };
  
  const expenses = await ExpenseModel.findAll(userId, filters);
  
  // Log sensitive data access if showing masked data
  if (filters.showMasked) {
    await AuditLogModel.create({
      userId,
      action: 'SENSITIVE_DATA_ACCESS',
      resourceType: 'expenses',
      details: { action: 'view_masked_data', filters },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceFingerprint: req.audit?.deviceFingerprint,
      geoLocation: req.geo
    });
  }
  
  res.json(expenses);
}));

// Get single expense
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const expenseId = parseInt(req.params.id);
  
  if (isNaN(expenseId)) {
    throw createError('Invalid expense ID', 400);
  }
  
  const expense = await ExpenseModel.findById(expenseId, userId);
  
  if (!expense) {
    throw createError('Expense not found', 404);
  }
  
  // Log access to individual expense
  await AuditLogModel.create({
    userId,
    action: 'EXPENSE_VIEW',
    resourceType: 'expense',
    resourceId: expenseId,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    deviceFingerprint: req.audit?.deviceFingerprint,
    geoLocation: req.geo
  });
  
  res.json(expense);
}));

// Create new expense
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const expenseData: ExpenseCreateRequest = req.body;
  
  // Validate required fields
  if (!expenseData.provider_name || !expenseData.amount || !expenseData.date) {
    throw createError('Provider name, amount, and date are required', 400);
  }
  
  if (expenseData.amount <= 0) {
    throw createError('Amount must be positive', 400);
  }
  
  const expense = await ExpenseModel.create(expenseData, userId);
  
  // Log expense creation
  await AuditLogModel.create({
    userId,
    action: 'EXPENSE_CREATE',
    resourceType: 'expense',
    resourceId: expense.id,
    details: { 
      provider: expense.provider_name,
      amount: expense.amount,
      sensitivity: expense.sensitivity_level 
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    deviceFingerprint: req.audit?.deviceFingerprint,
    geoLocation: req.geo
  });
  
  res.status(201).json(expense);
}));

// Update expense
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const expenseId = parseInt(req.params.id);
  const updateData: ExpenseUpdateRequest = req.body;
  
  if (isNaN(expenseId)) {
    throw createError('Invalid expense ID', 400);
  }
  
  if (updateData.amount !== undefined && updateData.amount <= 0) {
    throw createError('Amount must be positive', 400);
  }
  
  // Scan text fields for malicious content
  const textFields = [updateData.description, ...(updateData.tags || [])].filter(Boolean);
  for (const text of textFields) {
    const buffer = Buffer.from(text as string, 'utf8');
    const scanResult = await AntivirusService.scanFile(buffer, 'expense_text_field', 'text/plain');
    if (!scanResult.isClean) {
      throw createError(`Security scan failed on text content: ${scanResult.threats.join(', ')}`, 403);
    }
  }
  
  // Get original expense for audit trail
  const originalExpense = await ExpenseModel.findById(expenseId, userId);
  if (!originalExpense) {
    throw createError('Expense not found', 404);
  }
  
  const updatedExpense = await ExpenseModel.update(expenseId, updateData, userId);
  
  if (!updatedExpense) {
    throw createError('Failed to update expense', 500);
  }
  
  // Log expense update with changes
  await AuditLogModel.create({
    userId,
    action: 'EXPENSE_UPDATE',
    resourceType: 'expense',
    resourceId: expenseId,
    details: {
      before: {
        description: originalExpense.description,
        amount: originalExpense.amount,
        tags: originalExpense.tags,
        category: originalExpense.category
      },
      after: {
        description: updatedExpense.description,
        amount: updatedExpense.amount,
        tags: updatedExpense.tags,
        category: updatedExpense.category
      }
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    deviceFingerprint: req.audit?.deviceFingerprint,
    geoLocation: req.geo
  });
  
  res.json(updatedExpense);
}));

// Delete expense
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const expenseId = parseInt(req.params.id);
  
  if (isNaN(expenseId)) {
    throw createError('Invalid expense ID', 400);
  }
  
  // Get expense for audit trail
  const expense = await ExpenseModel.findById(expenseId, userId);
  if (!expense) {
    throw createError('Expense not found', 404);
  }
  
  const deleted = await ExpenseModel.delete(expenseId, userId);
  
  if (!deleted) {
    throw createError('Failed to delete expense', 500);
  }
  
  // Log expense deletion
  await AuditLogModel.create({
    userId,
    action: 'EXPENSE_DELETE',
    resourceType: 'expense',
    resourceId: expenseId,
    details: {
      provider: expense.provider_name,
      amount: expense.amount,
      sensitivity: expense.sensitivity_level
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    deviceFingerprint: req.audit?.deviceFingerprint,
    geoLocation: req.geo
  });
  
  res.json({ success: true, message: 'Expense deleted successfully' });
}));

// Get expense statistics
router.get('/stats/summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  
  const stats = await ExpenseModel.getStats(userId);
  
  res.json(stats);
}));

// Get monthly trend data
router.get('/stats/trend', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const months = parseInt(req.query.months as string) || 12;
  
  if (months > 24) {
    throw createError('Maximum 24 months of trend data allowed', 400);
  }
  
  const trendData = await ExpenseModel.getMonthlyTrend(userId, months);
  
  res.json(trendData);
}));

export default router;