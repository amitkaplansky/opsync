export interface User {
  id: number;
  username: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
  website?: string; // Honeypot field
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  expiresAt?: string;
}

export interface Expense {
  id: number;
  provider_name: string;
  provider_masked_name?: string;
  description?: string;
  amount: number;
  currency: string;
  date: string;
  due_date?: string;
  source_type: 'api' | 'manual';
  sensitivity_level: 'LOW' | 'MEDIUM' | 'HIGH';
  tags: string[] | null;
  category?: string;
  file_id?: number;
  file_path?: string;
  file_retention_policy?: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  retention_until?: string;
}

export interface ExpenseCreateRequest {
  provider_name: string;
  description?: string;
  amount: number;
  currency?: string;
  date: string;
  due_date?: string;
  tags?: string[];
  category?: string;
}

export interface ExpenseUpdateRequest {
  description?: string;
  amount?: number;
  currency?: string;
  due_date?: string;
  tags?: string[];
  category?: string;
  provider_name?: string;
  sensitivity_level?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DashboardStats {
  totalExpenses: number;
  monthlyTotal: number;
  monthlyChange: number;
  topProviders: {
    name: string;
    percentage: string;
    masked: boolean;
  }[];
  recentTransactions: number;
  trendData: {
    month: string;
    total: number;
    count: number;
  }[];
}

export interface FileUpload {
  file: File;
  sensitivity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface UploadResponse {
  success: boolean;
  message: string;
  file: {
    originalName: string;
    size: number;
    type: string;
  };
  ocrResults: {
    text: string;
    confidence: number;
    extractedData: {
      amount: string;
      currency: string;
      date: string;
      vendor: string;
    };
  };
}