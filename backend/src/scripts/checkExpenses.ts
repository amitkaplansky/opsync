import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function checkExpenses() {
  try {
    // Check all expenses
    const allExpenses = await query('SELECT id, provider_name, amount, date, source_type, created_at FROM expenses ORDER BY created_at DESC LIMIT 20');
    logger.info(`Total expenses: ${allExpenses.rows.length}`);
    
    console.log('\n=== Recent Expenses ===');
    allExpenses.rows.forEach((expense: any, index: number) => {
      console.log(`${index + 1}. ID: ${expense.id}, Provider: ${expense.provider_name || 'NULL'}, Amount: $${expense.amount}, Date: ${expense.date}, Source: ${expense.source_type}, Created: ${expense.created_at}`);
    });
    
    // Check specifically for Anthropic
    const anthropicExpenses = await query("SELECT * FROM expenses WHERE provider_name = 'Anthropic' OR provider_name ILIKE '%anthropic%' ORDER BY created_at DESC");
    console.log(`\n=== Anthropic Expenses: ${anthropicExpenses.rows.length} ===`);
    
    if (anthropicExpenses.rows.length > 0) {
      anthropicExpenses.rows.forEach((expense: any, index: number) => {
        console.log(`${index + 1}. ID: ${expense.id}, Provider: ${expense.provider_name}, Amount: $${expense.amount}, Date: ${expense.date}, Description: ${expense.description}, Metadata: ${JSON.stringify(expense.metadata)}`);
      });
    } else {
      console.log('No Anthropic expenses found!');
    }

    // Check table structure
    const tableStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'expenses' 
      ORDER BY ordinal_position
    `);
    
    console.log(`\n=== Expenses Table Structure ===`);
    tableStructure.rows.forEach((col: any) => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

  } catch (error) {
    logger.error('Error checking expenses:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await checkExpenses();
    
    console.log('\nDatabase check completed!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Database check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { checkExpenses };