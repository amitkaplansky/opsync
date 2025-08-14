import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function createTables() {
  try {
    logger.info('Creating database tables...');

    // Create expenses table
    await query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        provider_name VARCHAR(255) NOT NULL,
        provider_masked_name VARCHAR(255),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        date DATE NOT NULL,
        due_date DATE,
        description TEXT,
        category VARCHAR(100),
        tags TEXT[] DEFAULT '{}',
        source_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('api', 'manual', 'matched')),
        sensitivity_level VARCHAR(10) NOT NULL DEFAULT 'LOW' CHECK (sensitivity_level IN ('LOW', 'MEDIUM', 'HIGH')),
        file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
        file_path TEXT,
        file_retention_policy VARCHAR(20) DEFAULT 'DELETE' CHECK (file_retention_policy IN ('KEEP', 'DELETE')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- Add indexes for common queries
        INDEX idx_expenses_date (date),
        INDEX idx_expenses_provider (provider_name),
        INDEX idx_expenses_source_type (source_type),
        INDEX idx_expenses_sensitivity (sensitivity_level),
        INDEX idx_expenses_created_at (created_at)
      );
    `);
    logger.info('Expenses table created successfully');

    // Create files table (for invoice storage)
    await query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        retention_policy VARCHAR(20) DEFAULT 'DELETE' CHECK (retention_policy IN ('KEEP', 'DELETE')),
        processed BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'
      );
    `);
    logger.info('Files table created successfully');

    // Create users table (if not exists from existing code)
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        failed_login_attempts INTEGER DEFAULT 0,
        account_locked_until TIMESTAMP WITH TIME ZONE,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Users table created/verified successfully');

    // Create sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        refresh_token_hash VARCHAR(255),
        device_fingerprint VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_sessions_token (session_token),
        INDEX idx_sessions_user_id (user_id),
        INDEX idx_sessions_expires_at (expires_at)
      );
    `);
    logger.info('Sessions table created successfully');

    // Create audit_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INTEGER,
        ip_address INET,
        user_agent TEXT,
        details JSONB DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_audit_logs_user_id (user_id),
        INDEX idx_audit_logs_timestamp (timestamp),
        INDEX idx_audit_logs_action (action)
      );
    `);
    logger.info('Audit logs table created successfully');

    // Add functions for automatic data management
    await query(`
      -- Function to mask provider names for sensitive data
      CREATE OR REPLACE FUNCTION mask_provider_name(provider_name TEXT, sensitivity_level TEXT)
      RETURNS TEXT AS $$
      BEGIN
        CASE sensitivity_level
          WHEN 'HIGH' THEN
            RETURN CASE 
              WHEN LENGTH(provider_name) <= 3 THEN '***'
              ELSE LEFT(provider_name, 2) || REPEAT('*', LENGTH(provider_name) - 3) || RIGHT(provider_name, 1)
            END;
          WHEN 'MEDIUM' THEN
            RETURN CASE 
              WHEN LENGTH(provider_name) <= 5 THEN provider_name
              ELSE LEFT(provider_name, 3) || REPEAT('*', LENGTH(provider_name) - 6) || RIGHT(provider_name, 3)
            END;
          ELSE
            RETURN provider_name;
        END CASE;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Function to determine sensitivity level based on provider
    await query(`
      CREATE OR REPLACE FUNCTION get_provider_sensitivity(provider_name TEXT)
      RETURNS TEXT AS $$
      BEGIN
        -- HIGH sensitivity keywords
        IF LOWER(provider_name) ~ '.*(security|defense|military|government|health|medical|bank|finance|crypto|anthropic|openai|claude).*' THEN
          RETURN 'HIGH';
        END IF;
        
        -- MEDIUM sensitivity keywords  
        IF LOWER(provider_name) ~ '.*(aws|amazon|gcp|google|azure|microsoft|hosting|server|cloud).*' THEN
          RETURN 'MEDIUM';
        END IF;
        
        -- Default to LOW
        RETURN 'LOW';
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Trigger to automatically set retention policies and sensitivity
    await query(`
      CREATE OR REPLACE FUNCTION set_expense_defaults()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Set sensitivity level if not provided
        IF NEW.sensitivity_level = 'LOW' AND NEW.provider_name IS NOT NULL THEN
          NEW.sensitivity_level := get_provider_sensitivity(NEW.provider_name);
        END IF;
        
        -- Set masked provider name for high sensitivity
        IF NEW.sensitivity_level = 'HIGH' THEN
          NEW.provider_masked_name := mask_provider_name(NEW.provider_name, NEW.sensitivity_level);
        END IF;
        
        -- Set file retention policy based on sensitivity and amount
        IF NEW.file_id IS NOT NULL THEN
          IF NEW.sensitivity_level = 'HIGH' OR NEW.amount > 1000 THEN
            NEW.file_retention_policy := 'KEEP';
          ELSE
            NEW.file_retention_policy := 'DELETE';
          END IF;
        END IF;
        
        -- Update timestamp
        NEW.updated_at := CURRENT_TIMESTAMP;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger
    await query(`
      DROP TRIGGER IF EXISTS expense_defaults_trigger ON expenses;
      CREATE TRIGGER expense_defaults_trigger
        BEFORE INSERT OR UPDATE ON expenses
        FOR EACH ROW
        EXECUTE FUNCTION set_expense_defaults();
    `);

    logger.info('Database functions and triggers created successfully');
    logger.info('All database tables created successfully!');

  } catch (error) {
    logger.error('Error creating tables:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await createTables();
    
    logger.info('Database setup completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Database setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createTables };