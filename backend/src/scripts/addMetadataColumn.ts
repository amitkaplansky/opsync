import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function addMetadataColumn() {
  try {
    logger.info('Adding metadata column to expenses table...');

    // Add metadata column if it doesn't exist
    await query(`
      ALTER TABLE expenses 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `);

    logger.info('Metadata column added successfully');

    // Also add any other missing columns that might be needed
    await query(`
      DO $$ 
      BEGIN
        -- Check and add columns that might be missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='provider_masked_name') THEN
          ALTER TABLE expenses ADD COLUMN provider_masked_name VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='file_retention_policy') THEN
          ALTER TABLE expenses ADD COLUMN file_retention_policy VARCHAR(20) DEFAULT 'DELETE' CHECK (file_retention_policy IN ('KEEP', 'DELETE'));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='source_type') THEN
          ALTER TABLE expenses ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('api', 'manual', 'matched'));
        END IF;
      END $$;
    `);

    logger.info('All necessary columns verified/added');

  } catch (error) {
    logger.error('Error adding metadata column:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await addMetadataColumn();
    
    logger.info('Database schema update completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Database schema update failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { addMetadataColumn };