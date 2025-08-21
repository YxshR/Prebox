import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const isDemoMode = process.env.DEMO_MODE === 'true';

// Create a mock Redis client for demo mode
const mockRedisClient = {
  connect: async () => {
    console.log('🎭 Demo mode: Using mock Redis client');
    return Promise.resolve();
  },
  quit: async () => Promise.resolve(),
  setEx: async (key: string, seconds: number, value: string) => Promise.resolve('OK'),
  get: async (key: string) => Promise.resolve(null),
  del: async (key: string) => Promise.resolve(1),
  on: (event: string, callback: Function) => {},
  off: (event: string, callback: Function) => {},
};

const redisClient = isDemoMode 
  ? mockRedisClient as any
  : createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

if (!isDemoMode) {
  redisClient.on('error', (err: any) => {
    console.error('❌ Redis connection error:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Connected to Redis');
  });
}

export default redisClient;