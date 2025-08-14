import { query } from '@/config/database';

const mockExpenses2025 = [
  // Slack expenses (LOW sensitivity)
  {
    provider_name: 'Slack',
    description: 'Invoice #SLK-2025-001',
    amount: 199.99,
    currency: 'USD',
    date: '2025-01-15',
    due_date: '2025-02-14',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['communication', 'productivity']
  },
  {
    provider_name: 'Slack',
    description: 'Receipt #SLK-2025-047',
    amount: 249.99,
    currency: 'USD',
    date: '2025-02-15',
    due_date: '2025-03-17',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['communication', 'team-tools']
  },
  {
    provider_name: 'Slack',
    description: 'Invoice #SLK-2025-089',
    amount: 299.99,
    currency: 'USD',
    date: '2025-03-15',
    due_date: '2025-04-14',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['communication']
  },
  {
    provider_name: 'Slack',
    description: 'Receipt #SLK-2025-123',
    amount: 199.99,
    currency: 'USD',
    date: '2025-04-15',
    due_date: '2025-05-15',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['communication', 'monthly']
  },
  {
    provider_name: 'Slack',
    description: 'Invoice #SLK-2025-167',
    amount: 349.99,
    currency: 'USD',
    date: '2025-05-15',
    due_date: '2025-06-14',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['communication', 'upgrade']
  },

  // Jira expenses (LOW sensitivity)
  {
    provider_name: 'Jira',
    description: 'License #ATL-2025-0012',
    amount: 450.00,
    currency: 'USD',
    date: '2025-01-20',
    due_date: '2025-02-19',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['project-management', 'development']
  },
  {
    provider_name: 'Jira',
    description: 'Receipt #ATL-2025-0098',
    amount: 520.00,
    currency: 'USD',
    date: '2025-02-20',
    due_date: '2025-03-22',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['project-management', 'team-license']
  },
  {
    provider_name: 'Jira',
    description: 'Invoice #ATL-2025-0156',
    amount: 495.00,
    currency: 'USD',
    date: '2025-03-20',
    due_date: '2025-04-19',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['project-management']
  },
  {
    provider_name: 'Jira',
    description: 'License #ATL-2025-0234',
    amount: 580.00,
    currency: 'USD',
    date: '2025-04-20',
    due_date: '2025-05-20',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['project-management', 'additional-users']
  },
  {
    provider_name: 'Jira',
    description: 'Receipt #ATL-2025-0289',
    amount: 650.00,
    currency: 'USD',
    date: '2025-05-20',
    due_date: '2025-06-19',
    source_type: 'api',
    sensitivity_level: 'LOW',
    category: 'Software',
    tags: ['project-management', 'premium']
  },

  // no-name (HIGH security) - manually uploaded
  {
    provider_name: 'no-name',
    description: 'Document #NN-2025-001',
    amount: 1250.00,
    currency: 'USD',
    date: '2025-01-10',
    due_date: '2025-02-09',
    source_type: 'manual',
    sensitivity_level: 'HIGH',
    category: 'Security',
    tags: ['confidential', 'manual-upload']
  },
  {
    provider_name: 'no-name',
    description: 'Receipt #NN-2025-027',
    amount: 2100.00,
    currency: 'USD',
    date: '2025-02-08',
    due_date: '2025-03-10',
    source_type: 'manual',
    sensitivity_level: 'HIGH',
    category: 'Security',
    tags: ['confidential', 'high-priority']
  },
  {
    provider_name: 'no-name',
    description: 'Invoice #NN-2025-055',
    amount: 1875.50,
    currency: 'USD',
    date: '2025-03-12',
    due_date: '2025-04-11',
    source_type: 'manual',
    sensitivity_level: 'HIGH',
    category: 'Security',
    tags: ['confidential']
  },
  {
    provider_name: 'no-name',
    description: 'Document #NN-2025-078',
    amount: 3200.00,
    currency: 'USD',
    date: '2025-04-05',
    due_date: '2025-05-05',
    source_type: 'manual',
    sensitivity_level: 'HIGH',
    category: 'Security',
    tags: ['confidential', 'quarterly']
  },
  {
    provider_name: 'no-name',
    description: 'Receipt #NN-2025-099',
    amount: 1650.75,
    currency: 'USD',
    date: '2025-05-18',
    due_date: '2025-06-17',
    source_type: 'manual',
    sensitivity_level: 'HIGH',
    category: 'Security',
    tags: ['confidential', 'manual-upload']
  }
];

async function addMockData2025() {
  try {
    console.log('Adding 2025 mock expense data...');
    
    for (const expense of mockExpenses2025) {
      const result = await query(
        `INSERT INTO expenses (
          provider_name, description, amount, currency, date, due_date,
          source_type, sensitivity_level, tags, category, created_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          expense.provider_name,
          expense.description,
          expense.amount,
          expense.currency,
          expense.date,
          expense.due_date,
          expense.source_type,
          expense.sensitivity_level,
          expense.tags,
          expense.category
        ]
      );
      
      console.log(`Added expense for ${expense.provider_name}: ${expense.description} ($${expense.amount})`);
    }
    
    console.log(`Successfully added ${mockExpenses2025.length} mock expenses for 2025`);
    
  } catch (error) {
    console.error('Error adding mock data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addMockData2025()
    .then(() => {
      console.log('Mock data addition completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Mock data addition failed:', error);
      process.exit(1);
    });
}

export { addMockData2025 };