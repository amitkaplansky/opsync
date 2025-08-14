import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { createServer } from 'http';

import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';
import { geoBlocker } from '@/middleware/geoBlocker';
import { auditLogger } from '@/middleware/auditLogger';
import { logger } from '@/config/logger';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';

import authRoutes from '@/routes/auth';
import expenseRoutes from '@/routes/expenses';
import uploadRoutes from '@/routes/upload';
import dashboardRoutes from '@/routes/dashboard';
import anthropicRoutes from '@/routes/anthropic';
import AnthropicUsageJob from '@/jobs/anthropicUsageJob';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', true);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Temporarily disable middleware for testing
// app.use(rateLimiter);
// app.use(geoBlocker);
// app.use(auditLogger);

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/anthropic', anthropicRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    
    const server = createServer(app);
    
    server.listen(PORT, () => {
      logger.info(`OpSync backend server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start the Anthropic usage sync job
      AnthropicUsageJob.start();
      logger.info('Anthropic usage sync job started');
    });
    
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      // Stop the Anthropic usage job
      AnthropicUsageJob.stop();
      
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();