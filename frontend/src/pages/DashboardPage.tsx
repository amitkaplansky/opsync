import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  AlertTriangle,
  BarChart3,
  PieChart
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '@/services/api';
import { DashboardStats } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { clsx } from 'clsx';

const DashboardPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const data = await dashboardApi.getOverview();
        setDashboardData(data);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTrendData = (data: any[]) => {
    return data.map(item => ({
      month: new Date(item.month).toLocaleDateString('en-US', { 
        month: 'short',
        year: '2-digit'
      }),
      total: item.total
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-security-high mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          Unable to Load Dashboard
        </h2>
        <p className="text-primary-secondary">
          {error || 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Dashboard</h1>
          <p className="text-primary-secondary mt-0.5">
            Expenses overview
          </p>
        </div>
        
      </div>


      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Total Monthly Spending */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-secondary">
                Monthly Total
              </p>
              <p className="text-2xl font-bold text-primary-text mt-1">
                {formatCurrency(dashboardData.monthlyTotal)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary-button bg-opacity-20">
              <DollarSign className="w-6 h-6 text-primary-secondary" />
            </div>
          </div>
          
          {/* Monthly Change */}
          <div className="flex items-center mt-4">
            {dashboardData.monthlyChange >= 0 ? (
              <TrendingUp className="w-4 h-4 text-security-high mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-security-low mr-1" />
            )}
            <span className={clsx(
              'text-sm font-medium',
              dashboardData.monthlyChange >= 0 ? 'text-security-high' : 'text-security-low'
            )}>
              {Math.abs(dashboardData.monthlyChange)}%
            </span>
            <span className="text-sm text-primary-secondary ml-1">
              vs last month
            </span>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-secondary">
                Transactions
              </p>
              <p className="text-2xl font-bold text-primary-text mt-1">
                {dashboardData.recentTransactions}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary-button bg-opacity-20">
              <Activity className="w-6 h-6 text-primary-secondary" />
            </div>
          </div>
          <p className="text-sm text-primary-secondary mt-4">
            This month
          </p>
        </div>

        {/* Total Records */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-secondary">
                Total Records
              </p>
              <p className="text-2xl font-bold text-primary-text mt-1">
                {dashboardData.totalExpenses}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary-button bg-opacity-20">
              <BarChart3 className="w-6 h-6 text-primary-secondary" />
            </div>
          </div>
          <p className="text-sm text-primary-secondary mt-4">
            All time
          </p>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Spending Trend Chart */}
        <div className="xl:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-primary-text">
              Spending Trend
            </h2>
            <div className="text-sm text-primary-secondary">
              Last 6 months
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formatTrendData(dashboardData.trendData || [])}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5d0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#97914e"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#97914e"
                  fontSize={12}
                  tickFormatter={(value) => `$${value}k`}
                />
                <Tooltip 
                  formatter={(value: number) => [
                    formatCurrency(value),
                    'Amount'
                  ]}
                  labelStyle={{ color: '#1b1a0e' }}
                  contentStyle={{ 
                    backgroundColor: '#fcfbf8',
                    border: '1px solid #e7e5d0',
                    borderRadius: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#f0e675" 
                  strokeWidth={3}
                  dot={{ fill: '#f0e675', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Providers */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-primary-text">
              Top Providers
            </h2>
            <PieChart className="w-5 h-5 text-primary-secondary" />
          </div>
          
          <div className="space-y-4">
            {dashboardData.topProviders.map((provider, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-primary-text truncate">
                      {provider.name}
                    </p>
                  </div>
                  <div className="mt-1 w-full bg-primary-border rounded-full h-2">
                    <div 
                      className="bg-primary-button h-2 rounded-full"
                      style={{ width: `${provider.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium text-primary-text">
                  {provider.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;