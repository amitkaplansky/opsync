import bcrypt from 'bcryptjs';
import { connectDatabase, query } from '@/config/database';
import { logger } from '@/config/logger';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function updateAllPasswords() {
  try {
    logger.info('Updating all user passwords to "user4321"...');
    
    const newPassword = 'user4321';
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Get all users
    const usersResult = await query('SELECT id, username FROM users');
    
    if (usersResult.rows.length === 0) {
      logger.info('No users found in the database');
      return;
    }
    
    // Update all user passwords
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP',
      [passwordHash]
    );
    
    logger.info(`Updated passwords for ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(user => {
      logger.info(`  - ${user.username} (ID: ${user.id})`);
    });
    
    logger.info('All passwords updated to: user4321');
    
  } catch (error) {
    logger.error('Error updating passwords:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabase();
    await updateAllPasswords();
    
    logger.info('Password update completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Password update failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { updateAllPasswords };