# OpSync - OPSEC- Expense Monitoring System

A secure expense monitoring system designed. Built for operations teams who need to track expenses while maintaining operational security (OPSEC).

## OPSEC Principles

### 1. Identity Protection
- **Anonymous usernames**: `ops-user-1`, `ops-user-2`, etc.

### 2. Data Minimization Strategy
- **Small invoices (<$5,000)**: Extract data, delete file immediately
- **Medium invoices ($5,000-$20,000)**: Keep encrypted for 1 year
- **Large invoices (>$20,000)**: Keep encrypted permanently for audit
- **High-sensitivity providers**: Always mask provider names

### 3. Provider Sensitivity Levels
- **LOW**: Slack, Jira, common SaaS tools
- **MEDIUM**: AWS, GCP, hosting providers  
- **HIGH**: Government, security tools, health, finance

### 4. Progressive Data Reduction
- **0-30 days**: Full data available
- **30-90 days**: Keep only essential fields
- **90+ days**: Keep only hash + amount + masked provider

## Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone and Setup
```bash
git clone <repository-url>
cd opsync
```

### 2. Configure Environment
Create a `.env` file with your settings:
```bash
# Database
DATABASE_URL=postgresql://opsync_user:your_password@localhost:5432/opsync
POSTGRES_PASSWORD=some_password

# JWT Secrets (generate strong secrets)
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Third-party API integrations
ANTHROPIC_API_KEY=your_anthropic_api_key  # For Claude AI expense tracking

# Security and storage
ENCRYPTION_KEY=your_32_byte_encryption_key
MAX_FILE_SIZE=10485760                    # 10MB file upload limit
```

### 3. Start Services
```bash
# Start database
docker-compose up -d

# Install dependencies
npm install

# Seed database with demo users
npm run db:seed

# Start development servers
npm run dev
```

### 4. Access Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Database**: localhost:5432
