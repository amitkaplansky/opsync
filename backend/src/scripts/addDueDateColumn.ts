import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function addDueDateColumn() {
  try {
    logger.info('Adding due_date column to expenses table...');

    // Check if column already exists
    const columnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'expenses' AND column_name = 'due_date';
    `);

    if (columnExists.rows.length === 0) {
      await query(`
        ALTER TABLE expenses 
        ADD COLUMN due_date DATE;
      `);
      logger.info('Due date column added successfully to expenses table');
    } else {
      logger.info('Due date column already exists in expenses table');
    }

  } catch (error) {
    logger.error('Error adding due_date column:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await addDueDateColumn();
    
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

export { addDueDateColumn };