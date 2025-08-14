import { connectDatabase, query } from '@/config/database';
import { ExpenseModel } from '@/models/Expense';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function testExpenseQuery() {
  try {
    const userId = 6; // ops-user-1
    
    console.log('\n=== Testing Raw Database Query ===');
    // Test raw query first
    const rawQuery = `
      SELECT id, provider_name, amount, date, source_type, created_by, created_at 
      FROM expenses 
      WHERE (created_by = $1 OR created_by IS NULL) 
      ORDER BY created_at DESC
    `;
    const rawResult = await query(rawQuery, [userId]);
    console.log(`Raw query returned ${rawResult.rows.length} expenses`);
    
    // Show Anthropic ones specifically
    const anthropicFromRaw = rawResult.rows.filter(row => row.provider_name === 'Anthropic');
    console.log(`Raw query Anthropic expenses: ${anthropicFromRaw.length}`);
    anthropicFromRaw.forEach(expense => {
      console.log(`- ID: ${expense.id}, Provider: ${expense.provider_name}, Amount: $${expense.amount}, Date: ${expense.date}, created_by: ${expense.created_by}`);
    });
    
    console.log('\n=== Testing ExpenseModel.findAll ===');
    // Test using the model
    const modelResult = await ExpenseModel.findAll(userId);
    console.log(`ExpenseModel returned ${modelResult.length} expenses`);
    
    // Show Anthropic ones from model
    const anthropicFromModel = modelResult.filter(expense => expense.provider_name === 'Anthropic');
    console.log(`ExpenseModel Anthropic expenses: ${anthropicFromModel.length}`);
    anthropicFromModel.forEach(expense => {
      console.log(`- ID: ${expense.id}, Provider: ${expense.provider_name}, Amount: $${expense.amount}, Date: ${expense.date}`);
    });
    
    console.log('\n=== Testing ExpenseModel with no filters ===');
    // Test with empty filters
    const modelWithFilters = await ExpenseModel.findAll(userId, {});
    console.log(`ExpenseModel with empty filters returned ${modelWithFilters.length} expenses`);
    
    // Check if the issue is in the SELECT fields
    console.log('\n=== Testing Full Select Query ===');
    const fullQuery = `
      SELECT id, 
         CASE 
           WHEN sensitivity_level = 'HIGH' THEN provider_masked_name 
           ELSE provider_name 
         END as provider_name,
         provider_masked_name,
         description, amount, currency, date, source_type, 
         sensitivity_level, tags, category, file_id, created_by, 
         created_at, updated_at, retention_until, metadata, file_retention_policy
      FROM expenses 
      WHERE (created_by = $1 OR created_by IS NULL) 
      ORDER BY created_at DESC
    `;
    const fullResult = await query(fullQuery, [userId]);
    console.log(`Full select query returned ${fullResult.rows.length} expenses`);
    
    const anthropicFromFull = fullResult.rows.filter(row => row.provider_name === 'Anthropic');
    console.log(`Full query Anthropic expenses: ${anthropicFromFull.length}`);
    anthropicFromFull.forEach(expense => {
      console.log(`- ID: ${expense.id}, Provider: ${expense.provider_name}, Sensitivity: ${expense.sensitivity_level}, Masked Name: ${expense.provider_masked_name}`);
    });

  } catch (error) {
    logger.error('Error testing expense query:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await testExpenseQuery();
    
    console.log('\nTest completed!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}