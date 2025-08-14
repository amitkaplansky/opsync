import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  Upload,
  Calendar,
  DollarSign,
  FileText,
  Check,
  X,
  Trash2
} from 'lucide-react';
import { expensesApi } from '@/services/api';
import { Expense } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import UploadModal from '@/components/expenses/UploadModal';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    provider: '',
    category: '',
  });

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const data = await expensesApi.getAll({
        ...filters
      });
      setExpenses(data);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const startEditing = (expenseId: number, field: string, currentValue: string) => {
    setEditingExpense(expenseId);
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingExpense(null);
    setEditingField(null);
    setEditingValue('');
  };

  const saveEdit = async () => {
    if (!editingExpense || !editingField) return;

    try {
      const updateData: any = {};
      
      if (editingField === 'amount') {
        const numValue = parseFloat(editingValue);
        if (isNaN(numValue) || numValue <= 0) {
          alert('Please enter a valid amount greater than 0');
          return;
        }
        updateData.amount = numValue;
      } else if (editingField === 'tags') {
        updateData.tags = editingValue.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (editingField === 'provider_name') {
        if (!editingValue.trim()) {
          alert('Provider name cannot be empty');
          return;
        }
        updateData.provider_name = editingValue.trim();
      } else if (editingField === 'sensitivity_level') {
        if (!['LOW', 'MEDIUM', 'HIGH'].includes(editingValue)) {
          alert('Please select a valid sensitivity level');
          return;
        }
        updateData.sensitivity_level = editingValue;
      } else if (editingField === 'due_date') {
        updateData.due_date = editingValue || null; // Allow empty date to clear due date
      } else {
        updateData[editingField] = editingValue;
      }

      await expensesApi.update(editingExpense, updateData);
      await fetchExpenses();
      cancelEditing();
    } catch (error) {
      console.error('Failed to update expense:', error);
      alert('Failed to update expense');
    }
  };

  const deleteExpense = async (expenseId: number, expenseName: string) => {
    if (window.confirm(`Are you sure you want to delete the expense "${expenseName}"? This action cannot be undone.`)) {
      try {
        await expensesApi.delete(expenseId);
        await fetchExpenses();
      } catch (error) {
        console.error('Failed to delete expense:', error);
        alert('Failed to delete expense');
      }
    }
  };

  const formatCurrency = (amount: number, expenseId: number, masked: boolean = false) => {
    if (masked) {
      return '$***,***';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getSensitivityBadge = (level: string) => {
    const classes = {
      LOW: 'badge-security-low',
      MEDIUM: 'badge-security-medium',
      HIGH: 'badge-security-high'
    };
    return classes[level as keyof typeof classes] || 'badge-security-low';
  };


  const getProviderName = (expense: Expense) => {
    if (expense.sensitivity_level === 'HIGH' && expense.provider_masked_name) {
      return expense.provider_masked_name;
    }
    return expense.provider_name;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Expenses</h1>
          <p className="text-primary-secondary mt-0.5">
            Manage and monitor expense records
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Invoice</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex-shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Filter className="w-4 h-4 text-primary-secondary" />
            <h2 className="text-sm font-semibold text-primary-text">Filters</h2>
          </div>
          <div className="text-sm text-primary-secondary">
            {expenses.length} records
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <input
            type="date"
            placeholder="Start Date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input py-2 text-sm"
          />
          
          <input
            type="date"
            placeholder="End Date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input py-2 text-sm"
          />
          
          <input
            type="text"
            placeholder="Search providers..."
            value={filters.provider}
            onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
            className="input py-2 text-sm"
          />
          
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="input py-2 text-sm"
          >
            <option value="">All Categories</option>
            <option value="Software">Software</option>
            <option value="Infrastructure">Infrastructure</option>
            <option value="Security">Security</option>
            <option value="Services">Services</option>
            <option value="AI Services">AI Services</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card overflow-hidden flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col">
            <DollarSign className="w-12 h-12 text-primary-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary-text mb-2">
              No Expenses Found
            </h3>
            <p className="text-primary-secondary">
              Start by adding your first expense or uploading an invoice.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="h-full overflow-x-auto">
              <table className="table w-full h-full" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-primary-bg sticky top-0 z-20">
                <tr>
                  <th className="bg-primary-bg" style={{ width: '8%' }}>Date</th>
                  <th className="bg-primary-bg" style={{ width: '12%' }}>Provider</th>
                  <th className="bg-primary-bg" style={{ width: '6%' }}>Source</th>
                  <th className="bg-primary-bg" style={{ width: '20%' }}>Description</th>
                  <th className="bg-primary-bg" style={{ width: '8%' }}>Amount</th>
                  <th className="bg-primary-bg" style={{ width: '7%' }}>Sensitivity</th>
                  <th className="bg-primary-bg" style={{ width: '9%' }}>Category</th>
                  <th className="bg-primary-bg" style={{ width: '10%' }}>Tags</th>
                  <th className="bg-primary-bg" style={{ width: '5%' }} title="Shows if expense has uploaded invoice file">Invoice</th>
                  <th className="bg-primary-bg" style={{ width: '8%' }} title="Due date for invoices (if applicable)">Due Date</th>
                  <th className="bg-primary-bg" style={{ width: '7%' }} title="Delete expense">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        <Calendar className="w-4 h-4 text-primary-secondary" />
                        <span>
                          {format(new Date(expense.date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </td>
                    
                    <td>
                      {editingExpense === expense.id && editingField === 'provider_name' && expense.source_type === 'manual' ? (
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2 min-w-0 flex-1"
                            placeholder="Provider name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span 
                            className={clsx(
                              'font-medium p-1 rounded',
                              expense.source_type === 'manual' && 'cursor-pointer hover:bg-gray-100'
                            )}
                            onClick={() => {
                              if (expense.source_type === 'manual') {
                                startEditing(expense.id, 'provider_name', expense.provider_name);
                              }
                            }}
                            title={expense.source_type === 'manual' ? 'Click to edit provider name' : 'API-sourced provider (read-only)'}
                          >
                            {getProviderName(expense)}
                          </span>
                        </div>
                      )}
                    </td>
                    
                    <td className="text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        expense.source_type === 'api' ? 'bg-blue-100 text-blue-800' :
                        expense.source_type === 'manual' ? 'bg-green-100 text-green-800' :
                        expense.file_id ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {expense.source_type === 'api' ? 'API' :
                         expense.source_type === 'manual' && expense.file_id ? 'Matched' :
                         expense.source_type === 'manual' ? 'Manual' :
                         'Unknown'}
                      </span>
                    </td>
                    
                    <td>
                      {editingExpense === expense.id && editingField === 'description' ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2 min-w-0 flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="text-sm max-w-xs mx-auto cursor-pointer hover:bg-gray-100 p-1 rounded"
                          onClick={() => startEditing(expense.id, 'description', expense.description || '')}
                          title="Click to edit description"
                        >
                          {expense.description || '-'}
                        </div>
                      )}
                    </td>
                    
                    <td className="whitespace-nowrap">
                      {editingExpense === expense.id && editingField === 'amount' && (expense.source_type === 'manual' || expense.file_id) ? (
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2 w-24"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <span 
                          className={clsx(
                            'font-medium p-1 rounded',
                            (expense.source_type === 'manual' || expense.file_id) && 'cursor-pointer hover:bg-gray-100'
                          )}
                          onClick={() => {
                            // Allow editing for manual expenses or expenses with invoices (matched)
                            if (expense.source_type === 'manual' || expense.file_id) {
                              startEditing(expense.id, 'amount', expense.amount.toString());
                            }
                          }}
                          title={
                            (expense.source_type === 'manual' || expense.file_id) 
                              ? 'Click to edit amount' 
                              : 'API-sourced amount (read-only)'
                          }
                        >
                          {formatCurrency(
                            expense.amount,
                            expense.id,
                            false
                          )}
                        </span>
                      )}
                    </td>
                    
                    <td className="whitespace-nowrap">
                      {editingExpense === expense.id && editingField === 'sensitivity_level' && expense.source_type === 'manual' ? (
                        <div className="flex items-center justify-center space-x-2">
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          >
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                          </select>
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <span 
                            className={clsx(
                              'badge cursor-pointer hover:opacity-75',
                              getSensitivityBadge(expense.sensitivity_level),
                              expense.source_type !== 'manual' && 'cursor-not-allowed opacity-60'
                            )}
                            onClick={() => {
                              if (expense.source_type === 'manual') {
                                startEditing(expense.id, 'sensitivity_level', expense.sensitivity_level);
                              }
                            }}
                            title={expense.source_type === 'manual' ? 'Click to edit sensitivity level' : 'API-sourced sensitivity (read-only)'}
                          >
                            {expense.sensitivity_level}
                          </span>
                        </div>
                      )}
                    </td>
                    
                    <td className="whitespace-nowrap">
                      {editingExpense === expense.id && editingField === 'category' && (expense.source_type === 'manual' || expense.file_id) ? (
                        <div className="flex items-center justify-center space-x-2">
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          >
                            <option value="">Select category...</option>
                            <option value="Software">Software</option>
                            <option value="Infrastructure">Infrastructure</option>
                            <option value="Security">Security</option>
                            <option value="Services">Services</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Office">Office</option>
                            <option value="Travel">Travel</option>
                            <option value="Other">Other</option>
                          </select>
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <span 
                          className={clsx(
                            'text-sm p-1 rounded',
                            (expense.source_type === 'manual' || expense.file_id) && 'cursor-pointer hover:bg-gray-100'
                          )}
                          onClick={() => {
                            if (expense.source_type === 'manual' || expense.file_id) {
                              startEditing(expense.id, 'category', expense.category || '');
                            }
                          }}
                          title={(expense.source_type === 'manual' || expense.file_id) ? 'Click to edit category' : 'API-sourced category (read-only)'}
                        >
                          {expense.category || '-'}
                        </span>
                      )}
                    </td>
                    
                    <td>
                      {editingExpense === expense.id && editingField === 'tags' ? (
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2 w-32"
                            placeholder="tag1, tag2"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="flex flex-wrap gap-1 justify-center cursor-pointer hover:bg-gray-100 p-1 rounded"
                          onClick={() => startEditing(expense.id, 'tags', (expense.tags || []).join(', '))}
                          title="Click to edit tags"
                        >
                          {(expense.tags || []).slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-button bg-opacity-20 text-primary-text"
                            >
                              {tag}
                            </span>
                          ))}
                          {(expense.tags || []).length > 2 && (
                            <span className="text-xs text-primary-secondary">
                              +{(expense.tags || []).length - 2}
                            </span>
                          )}
                          {(expense.tags || []).length === 0 && (
                            <span className="text-xs text-gray-400">
                              Click to add tags
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    <td className="whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        {expense.file_path && expense.file_retention_policy === 'KEEP' ? (
                          <button
                            onClick={() => window.open(`/api/expenses/${expense.id}/invoice`, '_blank')}
                            className="p-1 rounded hover:bg-primary-button hover:bg-opacity-20 transition-colors"
                            title="View invoice"
                          >
                            <FileText className="w-4 h-4 text-primary-secondary" />
                          </button>
                        ) : (
                          <span className="text-xs text-primary-secondary">-</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="whitespace-nowrap">
                      {editingExpense === expense.id && editingField === 'due_date' && expense.source_type === 'manual' ? (
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="date"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input text-sm py-1 px-2 w-32"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className={expense.source_type === 'manual' ? 'cursor-pointer hover:bg-gray-100 p-1 rounded' : ''}
                          onClick={() => {
                            if (expense.source_type === 'manual') {
                              // Format date for HTML date input (YYYY-MM-DD)
                              const formattedDate = expense.due_date 
                                ? new Date(expense.due_date).toISOString().split('T')[0] 
                                : '';
                              startEditing(expense.id, 'due_date', formattedDate);
                            }
                          }}
                          title={expense.source_type === 'manual' ? 'Click to edit due date' : 'API-sourced due date (read-only)'}
                        >
                          {expense.due_date ? (
                            <div className="flex items-center justify-center space-x-2">
                              <Calendar className="w-4 h-4 text-orange-400" />
                              <span className="text-sm">
                                {format(new Date(expense.due_date), 'MMM dd')}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className="text-xs text-gray-400">-</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    
                    <td className="whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => deleteExpense(expense.id, expense.provider_name)}
                          className="p-1 rounded hover:bg-red-100 transition-colors text-red-600 hover:text-red-800"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showExpenseForm && (
        <ExpenseForm
          expense={selectedExpense}
          onClose={() => {
            setShowExpenseForm(false);
            setSelectedExpense(null);
          }}
          onSave={() => {
            fetchExpenses();
            setShowExpenseForm(false);
            setSelectedExpense(null);
          }}
        />
      )}

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={() => {
            fetchExpenses();
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
};

export default ExpensesPage;