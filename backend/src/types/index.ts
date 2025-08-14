export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_active: boolean;
  last_login?: Date;
  failed_login_attempts: number;
  account_locked_until?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Expense {
  id: number;
  provider_name: string;
  provider_masked_name?: string;
  description?: string;
  amount: number;
  currency: string;
  date: Date;
  due_date?: Date;
  source_type: 'api' | 'manual';
  sensitivity_level: 'LOW' | 'MEDIUM' | 'HIGH';
  tags: string[];
  category?: string;
  file_id?: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  retention_until?: Date;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  resource_type?: string;
  resource_id?: number;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
  geo_location?: any;
  timestamp: Date;
}

export interface FileRecord {
  id: number;
  original_filename: string;
  encrypted_filename: string;
  file_size: number;
  mime_type: string;
  encryption_key_hash: string;
  sensitivity_level: 'LOW' | 'MEDIUM' | 'HIGH';
  retention_policy: 'immediate' | 'temporary' | 'permanent';
  ocr_extracted_text?: string;
  processing_status: string;
  uploaded_by: number;
  uploaded_at: Date;
  expires_at?: Date;
  deleted_at?: Date;
}

export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  refresh_token_hash: string;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  geo_location?: any;
  expires_at: Date;
  created_at: Date;
  last_accessed: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
  website?: string; // Honeypot field
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: number;
    username: string;
  };
  expiresAt?: Date;
}

export interface RefreshTokenRequest {
  refreshToken: string;
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
    percentage: number;
    masked: boolean;
  }[];
  recentTransactions: number;
}