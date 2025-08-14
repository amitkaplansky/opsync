import axios from 'axios';
import { LoginRequest, LoginResponse, Expense, ExpenseCreateRequest, ExpenseUpdateRequest, DashboardStats } from '@/types';

const API_BASE_URL = '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('opsync_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url !== '/auth/login') {
      // Token expired or invalid (but not a login attempt)
      localStorage.removeItem('opsync_token');
      localStorage.removeItem('opsync_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    api.post('/auth/login', credentials).then(res => res.data),
  
  logout: (userId: number): Promise<void> =>
    api.post('/auth/logout', { userId }).then(res => res.data),
  
  refresh: (): Promise<LoginResponse> =>
    api.post('/auth/refresh').then(res => res.data),
  
  me: (): Promise<{ authenticated: boolean }> =>
    api.get('/auth/me').then(res => res.data),
};

// Expenses API
export const expensesApi = {
  getAll: (filters?: {
    startDate?: string;
    endDate?: string;
    provider?: string;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    showMasked?: boolean;
  }): Promise<Expense[]> =>
    api.get('/expenses', { params: filters }).then(res => res.data),
  
  getById: (id: number): Promise<Expense> =>
    api.get(`/expenses/${id}`).then(res => res.data),
  
  create: (expense: ExpenseCreateRequest): Promise<Expense> =>
    api.post('/expenses', expense).then(res => res.data),
  
  update: (id: number, expense: ExpenseUpdateRequest): Promise<Expense> =>
    api.put(`/expenses/${id}`, expense).then(res => res.data),
  
  delete: (id: number): Promise<{ success: boolean; message: string }> =>
    api.delete(`/expenses/${id}`).then(res => res.data),
  
  getStats: (): Promise<any> =>
    api.get('/expenses/stats/summary').then(res => res.data),
  
  getTrend: (months?: number): Promise<any[]> =>
    api.get('/expenses/stats/trend', { params: { months } }).then(res => res.data),
};

// Dashboard API
export const dashboardApi = {
  getOverview: (): Promise<DashboardStats> =>
    api.get('/dashboard/overview').then(res => res.data),
  
  getActivity: (hours?: number): Promise<any> =>
    api.get('/dashboard/activity', { params: { hours } }).then(res => res.data),
  
  getSecurity: (): Promise<any> =>
    api.get('/dashboard/security').then(res => res.data),
  
  getRetention: (): Promise<any> =>
    api.get('/dashboard/retention').then(res => res.data),
};

// Upload API
export const uploadApi = {
  uploadInvoice: (file: File, sensitivity?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('invoice', file);
    if (sensitivity) {
      formData.append('sensitivity', sensitivity);
    }
    
    return api.post('/upload/invoice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => res.data);
  },
  
  createExpenseFromUpload: (data: {
    provider_name: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    due_date?: string;
    sensitivity: string;
    file_path?: string;
  }): Promise<any> =>
    api.post('/expenses', {
      ...data,
      source_type: 'manual'
    }).then(res => res.data),
  
  getHistory: (): Promise<any> =>
    api.get('/upload/history').then(res => res.data),
};

export default api;