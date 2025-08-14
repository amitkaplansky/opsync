import { createClient } from 'redis';
import { logger } from './logger';

let redisClient: ReturnType<typeof createClient>;

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_delay_on_failure: 100,
      retry_delay_on_cluster_down: 100,
      retry_delay_on_failover: 50,
      max_attempts: 3,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
    
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client not initialized or disconnected');
  }
  return redisClient;
};

export const setWithExpiry = async (key: string, value: string, expiry: number) => {
  const client = getRedisClient();
  return await client.setEx(key, expiry, value);
};

export const get = async (key: string) => {
  const client = getRedisClient();
  return await client.get(key);
};

export const del = async (key: string) => {
  const client = getRedisClient();
  return await client.del(key);
};

export const increment = async (key: string, expiry?: number) => {
  const client = getRedisClient();
  const result = await client.incr(key);
  if (expiry && result === 1) {
    await client.expire(key, expiry);
  }
  return result;
};

export const exists = async (key: string) => {
  const client = getRedisClient();
  return await client.exists(key);
};