import { connectDatabase, query } from '@/config/database';
import { ExpenseModel } from '@/models/Expense';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function testFrontendAPI() {
  try {
    const userId = 6; // ops-user-1
    
    console.log('\n=== Testing ExpenseModel.findAll (Frontend API simulation) ===');
    
    // This is exactly what the frontend API calls
    const expenses = await ExpenseModel.findAll(userId);
    console.log(`Total expenses returned: ${expenses.length}`);
    
    // Filter for Anthropic expenses
    const anthropicExpenses = expenses.filter(expense => 
      expense.provider_name === 'Anthropic' || 
      expense.provider_name?.toLowerCase().includes('anthropic')
    );
    
    console.log(`\nAnthropic expenses found: ${anthropicExpenses.length}`);
    anthropicExpenses.forEach((expense, index) => {
      console.log(`${index + 1}. ID: ${expense.id}`);
      console.log(`   Provider Name: "${expense.provider_name}"`);
      console.log(`   Provider Masked Name: "${expense.provider_masked_name}"`);
      console.log(`   Amount: $${expense.amount}`);
      console.log(`   Date: ${expense.date}`);
      console.log(`   Source Type: ${expense.source_type}`);
      console.log(`   Sensitivity: ${expense.sensitivity_level}`);
      console.log(`   Created By: ${expense.created_by || 'NULL'}`);
      console.log('');
    });
    
    // Test with filters (what frontend might use for search)
    console.log('=== Testing with provider filter ===');
    const filteredExpenses = await ExpenseModel.findAll(userId, { 
      provider: 'anthropic' 
    });
    console.log(`Filtered expenses (anthropic): ${filteredExpenses.length}`);
    
    // Show all expenses with basic info
    console.log('\n=== All Expenses Summary ===');
    expenses.forEach(expense => {
      console.log(`${expense.provider_name} - $${expense.amount} - ${expense.date} - ${expense.source_type}`);
    });

  } catch (error) {
    logger.error('Error testing frontend API:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await testFrontendAPI();
    
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