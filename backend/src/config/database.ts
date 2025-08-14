import { Pool } from 'pg';
import { logger } from './logger';

let pool: Pool;

export const connectDatabase = async (): Promise<void> => {
  try {
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'opsync',
      user: 'opsync_user',
      password: process.env.POSTGRES_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await pool.connect();
    logger.info('Connected to PostgreSQL database');
    
    // Skip migrations for faster startup (run manually if needed)
    // await runMigrations();
    
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
};

export const query = async (text: string, params?: any[]) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

export const transaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const runMigrations = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      '001_create_users_table',
      '002_create_expenses_table', 
      '003_create_audit_logs_table',
      '004_create_files_table',
      '005_create_sessions_table'
    ];

    for (const migration of migrations) {
      const exists = await query(
        'SELECT name FROM migrations WHERE name = $1',
        [migration]
      );

      if (exists.rows.length === 0) {
        await executeMigration(migration);
        await query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration]
        );
        logger.info(`Migration ${migration} executed successfully`);
      }
    }
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

const executeMigration = async (migrationName: string) => {
  switch (migrationName) {
    case '001_create_users_table':
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          failed_login_attempts INTEGER DEFAULT 0,
          account_locked_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      break;

    case '002_create_expenses_table':
      await query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          provider_name VARCHAR(255) NOT NULL,
          provider_masked_name VARCHAR(255),
          description TEXT,
          amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'USD',
          date DATE NOT NULL,
          source_type VARCHAR(20) CHECK (source_type IN ('api', 'manual')) NOT NULL,
          sensitivity_level VARCHAR(10) CHECK (sensitivity_level IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'LOW',
          tags TEXT[],
          category VARCHAR(100),
          file_id INTEGER,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          retention_until TIMESTAMP
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_provider ON expenses(provider_name);
        CREATE INDEX IF NOT EXISTS idx_expenses_sensitivity ON expenses(sensitivity_level);
        CREATE INDEX IF NOT EXISTS idx_expenses_retention ON expenses(retention_until);
      `);
      break;

    case '003_create_audit_logs_table':
      await query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id INTEGER,
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          device_fingerprint VARCHAR(255),
          geo_location JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      `);
      break;

    case '004_create_files_table':
      await query(`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          original_filename VARCHAR(255) NOT NULL,
          encrypted_filename VARCHAR(255) NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          encryption_key_hash VARCHAR(255) NOT NULL,
          sensitivity_level VARCHAR(10) CHECK (sensitivity_level IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'LOW',
          retention_policy VARCHAR(20) CHECK (retention_policy IN ('immediate', 'temporary', 'permanent')) DEFAULT 'immediate',
          ocr_extracted_text TEXT,
          processing_status VARCHAR(20) DEFAULT 'pending',
          uploaded_by INTEGER REFERENCES users(id),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          deleted_at TIMESTAMP
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
        CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
        CREATE INDEX IF NOT EXISTS idx_files_retention ON files(retention_policy);
      `);
      break;

    case '005_create_sessions_table':
      await query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) NOT NULL UNIQUE,
          refresh_token_hash VARCHAR(255) NOT NULL,
          device_fingerprint VARCHAR(255),
          ip_address INET,
          user_agent TEXT,
          geo_location JSONB,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `);
      break;

    default:
      throw new Error(`Unknown migration: ${migrationName}`);
  }
};