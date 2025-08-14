import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function checkAnthropicSensitivity() {
  try {
    const result = await query('SELECT id, provider_name, provider_masked_name, sensitivity_level FROM expenses WHERE provider_name = $1', ['Anthropic']);
    
    console.log(`Found ${result.rows.length} Anthropic expenses:`);
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}, provider_name: "${row.provider_name}", masked: "${row.provider_masked_name}", sensitivity: ${row.sensitivity_level}`);
    });

    // Test the CASE statement logic
    console.log('\n=== Testing CASE statement logic ===');
    const caseResult = await query(`
      SELECT id, 
        provider_name as original_name,
        provider_masked_name,
        sensitivity_level,
        CASE 
          WHEN sensitivity_level = 'HIGH' THEN provider_masked_name 
          ELSE provider_name 
        END as displayed_name
      FROM expenses WHERE provider_name = $1
    `, ['Anthropic']);
    
    caseResult.rows.forEach(row => {
      console.log(`ID: ${row.id}, original: "${row.original_name}", sensitivity: ${row.sensitivity_level}, displayed: "${row.displayed_name}"`);
    });

  } catch (error) {
    logger.error('Error checking Anthropic sensitivity:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await checkAnthropicSensitivity();
    
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