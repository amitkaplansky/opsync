import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function checkAnthropicUserId() {
  try {
    // Check user IDs
    const users = await query('SELECT id, username FROM users ORDER BY id');
    console.log('\n=== Users ===');
    users.rows.forEach((user: any) => {
      console.log(`ID: ${user.id}, Username: ${user.username}`);
    });

    // Check Anthropic expenses user association
    const anthropicExpenses = await query('SELECT id, provider_name, amount, created_by, created_at FROM expenses WHERE provider_name = $1 ORDER BY created_at DESC', ['Anthropic']);
    console.log('\n=== Anthropic Expenses User Association ===');
    anthropicExpenses.rows.forEach((expense: any) => {
      console.log(`Expense ID: ${expense.id}, Provider: ${expense.provider_name}, Amount: ${expense.amount}, created_by: ${expense.created_by || 'NULL'}, created_at: ${expense.created_at}`);
    });

  } catch (error) {
    logger.error('Error checking Anthropic user ID:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await checkAnthropicUserId();
    
    console.log('\nCheck completed!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}