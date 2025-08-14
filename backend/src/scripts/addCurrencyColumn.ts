import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function addCurrencyColumn() {
  try {
    logger.info('Adding currency column to expenses table...');

    // Check if column already exists
    const columnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'expenses' AND column_name = 'currency';
    `);

    if (columnExists.rows.length === 0) {
      await query(`
        ALTER TABLE expenses 
        ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
      `);
      logger.info('Currency column added successfully to expenses table');
    } else {
      logger.info('Currency column already exists in expenses table');
    }

  } catch (error) {
    logger.error('Error adding currency column:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await addCurrencyColumn();
    
    logger.info('Database migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { addCurrencyColumn };