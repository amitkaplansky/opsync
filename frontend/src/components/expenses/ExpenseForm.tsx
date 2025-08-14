import React from 'react';
import { useForm } from 'react-hook-form';
import { X, DollarSign } from 'lucide-react';
import { expensesApi } from '@/services/api';
import { Expense, ExpenseCreateRequest, ExpenseUpdateRequest } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface ExpenseFormProps {
  expense?: Expense | null;
  onClose: () => void;
  onSave: () => void;
}

interface FormData {
  provider_name: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  tags: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ expense, onClose, onSave }) => {
  const isEditing = !!expense;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      provider_name: expense?.provider_name || '',
      description: expense?.description || '',
      amount: expense?.amount || 0,
      currency: expense?.currency || 'USD',
      date: expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
      category: expense?.category || '',
      tags: expense?.tags?.join(', ') || '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const tags = data.tags
        ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : [];

      if (isEditing) {
        const updateData: ExpenseUpdateRequest = {
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          category: data.category,
          tags,
        };
        
        await expensesApi.update(expense.id, updateData);
        toast.success('Expense updated successfully');
      } else {
        const createData: ExpenseCreateRequest = {
          provider_name: data.provider_name,
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          date: data.date,
          category: data.category,
          tags,
        };
        
        await expensesApi.create(createData);
        toast.success('Expense created successfully');
      }
      
      onSave();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save expense';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary-button bg-opacity-20">
              <DollarSign className="w-5 h-5 text-primary-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-primary-text">
              {isEditing ? 'Edit Expense' : 'Add New Expense'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-primary-button hover:bg-opacity-20 transition-colors"
          >
            <X className="w-5 h-5 text-primary-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Provider Name (only for new expenses) */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-primary-text mb-2">
                Provider Name *
              </label>
              <input
                {...register('provider_name', {
                  required: 'Provider name is required',
                  minLength: {
                    value: 2,
                    message: 'Provider name must be at least 2 characters',
                  },
                })}
                type="text"
                placeholder="e.g., AWS, Google Cloud, Slack"
                className="input"
              />
              {errors.provider_name && (
                <p className="mt-1 text-sm text-security-high">
                  {errors.provider_name.message}
                </p>
              )}
            </div>
          )}
          
          {/* Provider Info (for editing mode) */}
          {isEditing && (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Provider (Read-only)
              </label>
              <p className="text-lg font-semibold text-gray-800">{expense?.provider_name}</p>
              <p className="text-xs text-gray-500 mt-1">
                Provider name cannot be changed for security and audit reasons
              </p>
            </div>
          )}

          {/* Amount and Currency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-primary-text mb-2">
                Amount *
              </label>
              <input
                {...register('amount', {
                  required: 'Amount is required',
                  min: {
                    value: 0.01,
                    message: 'Amount must be greater than 0',
                  },
                  valueAsNumber: true,
                })}
                type="number"
                step="0.01"
                placeholder="0.00"
                className="input"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-security-high">
                  {errors.amount.message}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-primary-text mb-2">
                Currency
              </label>
              <select
                {...register('currency')}
                className="input"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ILS">ILS</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Date {!isEditing && '*'}
            </label>
            {isEditing ? (
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm font-medium text-gray-800">
                  {expense && format(new Date(expense.date), 'EEEE, MMMM dd, yyyy')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Date cannot be changed to maintain audit trail integrity
                </p>
              </div>
            ) : (
              <>
                <input
                  {...register('date', {
                    required: 'Date is required',
                  })}
                  type="date"
                  className="input"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-security-high">
                    {errors.date.message}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Category
            </label>
            <select
              {...register('category')}
              className="input"
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
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Brief description of the expense..."
              className="input resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Tags
            </label>
            <input
              {...register('tags')}
              type="text"
              placeholder="saas, development, security (comma-separated)"
              className="input"
            />
            <p className="mt-1 text-xs text-primary-secondary">
              Separate multiple tags with commas
            </p>
          </div>

          {/* Editing Notice */}
          {isEditing && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Editing Mode:</strong> You can modify the description, amount, currency, category, and tags. 
                Provider name and date are locked for security and audit compliance.
              </p>
            </div>
          )}
          
          {/* Security Notice */}
          {!isEditing && (
            <div className="p-4 rounded-lg bg-primary-button bg-opacity-10 border border-primary-border">
              <p className="text-sm text-primary-secondary">
                <strong>Security Note:</strong> Expenses are automatically classified based on provider sensitivity. 
                High-sensitivity providers will be masked in reports for OPSEC compliance.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-primary-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="small" />
                  <span>{isEditing ? 'Updating...' : 'Creating...'}</span>
                </div>
              ) : (
                isEditing ? 'Update Expense' : 'Create Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;