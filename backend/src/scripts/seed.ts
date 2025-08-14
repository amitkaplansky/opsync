import bcrypt from 'bcryptjs';
import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function createDefaultUsers() {
  try {
    logger.info('Creating default anonymous users...');
    
    const users = [
      { username: 'ops-user-1', password: 'OpSync2024User1' },
      { username: 'ops-user-2', password: 'OpSync2024User2' },
      { username: 'ops-user-3', password: 'OpSync2024User3' },
      { username: 'ops-user-4', password: 'OpSync2024User4' },
      { username: 'ops-user-5', password: 'OpSync2024User5' }
    ];
    
    for (const userData of users) {
      // Check if user already exists
      const existing = await query(
        'SELECT id FROM users WHERE username = $1',
        [userData.username]
      );
      
      if (existing.rows.length > 0) {
        logger.info(`User ${userData.username} already exists, skipping...`);
        continue;
      }
      
      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);
      
      // Create user
      await query(
        `INSERT INTO users (username, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userData.username, passwordHash, true]
      );
      
      logger.info(`Created user: ${userData.username}`);
    }
    
    // Create sample expenses for demonstration
    await createSampleExpenses();
    
  } catch (error) {
    logger.error('Error creating default users:', error);
    throw error;
  }
}

async function createSampleExpenses() {
  try {
    logger.info('Creating sample expenses...');
    
    // Get first user ID
    const userResult = await query('SELECT id FROM users WHERE username = $1', ['ops-user-1']);
    if (userResult.rows.length === 0) {
      logger.warn('No users found for sample expenses');
      return;
    }
    
    const userId = userResult.rows[0].id;
    
    const sampleExpenses = [
      // LOW sensitivity
      {
        provider_name: 'Slack Technologies',
        description: 'Monthly team communication platform',
        amount: 149.99,
        currency: 'USD',
        date: new Date('2024-01-15'),
        source_type: 'api',
        sensitivity_level: 'LOW',
        tags: ['communication', 'saas'],
        category: 'Software'
      },
      {
        provider_name: 'Jira Software',
        description: 'Project management and issue tracking',
        amount: 89.99,
        currency: 'USD', 
        date: new Date('2024-01-20'),
        source_type: 'manual',
        sensitivity_level: 'LOW',
        tags: ['project-management', 'development'],
        category: 'Software'
      },
      
      // MEDIUM sensitivity
      {
        provider_name: 'Amazon Web Services',
        description: 'Cloud infrastructure and services',
        amount: 2847.32,
        currency: 'USD',
        date: new Date('2024-01-31'),
        source_type: 'api', 
        sensitivity_level: 'MEDIUM',
        tags: ['infrastructure', 'cloud'],
        category: 'Infrastructure'
      },
      {
        provider_name: 'Google Cloud Platform',
        description: 'Additional cloud services and storage',
        amount: 1245.67,
        currency: 'USD',
        date: new Date('2024-02-01'),
        source_type: 'api',
        sensitivity_level: 'MEDIUM',
        tags: ['infrastructure', 'cloud', 'storage'],
        category: 'Infrastructure'
      },
      
      // HIGH sensitivity (will be masked)
      {
        provider_name: 'CyberArk Software',
        description: 'Privileged access management solution',
        amount: 15000.00,
        currency: 'USD',
        date: new Date('2024-01-10'),
        source_type: 'manual',
        sensitivity_level: 'HIGH',
        tags: ['security', 'access-management'],
        category: 'Security'
      },
      {
        provider_name: 'Mossad Consulting Services',
        description: 'Security consultation and threat assessment',
        amount: 25000.00,
        currency: 'USD',
        date: new Date('2024-02-15'),
        source_type: 'manual',
        sensitivity_level: 'HIGH',
        tags: ['security', 'consulting'],
        category: 'Security'
      }
    ];
    
    for (const expense of sampleExpenses) {
      await query(
        `INSERT INTO expenses (
          provider_name, description, amount, currency, date, 
          source_type, sensitivity_level, tags, category, created_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          expense.provider_name,
          expense.description,
          expense.amount,
          expense.currency,
          expense.date,
          expense.source_type,
          expense.sensitivity_level,
          expense.tags,
          expense.category,
          userId
        ]
      );
    }
    
    logger.info(`Created ${sampleExpenses.length} sample expenses`);
    
  } catch (error) {
    logger.error('Error creating sample expenses:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await createDefaultUsers();
    
    logger.info('Seeding completed successfully!');
    logger.info('Default users created:');
    logger.info('  ops-user-1 / OpSync2024User1');
    logger.info('  ops-user-2 / OpSync2024User2'); 
    logger.info('  ops-user-3 / OpSync2024User3');
    logger.info('  ops-user-4 / OpSync2024User4');
    logger.info('  ops-user-5 / OpSync2024User5');
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createDefaultUsers };