import cron from 'node-cron';
import pool from '../config/database';
import redisClient from '../config/redis';
import { SecureOTPService } from './secure-otp.service';

export interface CleanupStats {
  timestamp: Date;
  deletedOTPs: number;
  cleanedRedisKeys: number;
  duration: number;
  errors: string[];
}

export interface CleanupConfig {
  enabled: boolean;
  cronSchedule: string; // Default: '0 */6 * * *' (every 6 hours)
  batchSize: number;
  maxAge: number; // hours
  logResults: boolean;
}

/**
 * OTP Cleanup Service for managing expired and used OTP records
 */
export class OTPCleanupService {
  private otpService: SecureOTPService;
  private config: CleanupConfig;
  private isRunning: boolean = false;
  private lastCleanup?: CleanupStats;
  private cleanupHistory: CleanupStats[] = [];

  constructor(config?: Partial<CleanupConfig>) {
    this.config = {
      enabled: true,
      cronSchedule: '0 */6 * * *', // Every 6 hours
      batchSize: 1000,
      maxAge: 24, // 24 hours
      logResults: true,
      ...config
    };

    this.otpService = new SecureOTPService();
  }

  /**
   * Start the cleanup service with scheduled jobs
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('🧹 OTP Cleanup Service is disabled');
      return;
    }

    console.log(`🧹 Starting OTP Cleanup Service with schedule: ${this.config.cronSchedule}`);
    
    // Schedule cleanup job
    cron.schedule(this.config.cronSchedule, async () => {
      if (!this.isRunning) {
        await this.runCleanup();
      } else {
        console.warn('⚠️ OTP cleanup already running, skipping this cycle');
      }
    });

    // Run initial cleanup
    setTimeout(() => this.runCleanup(), 5000); // Wait 5 seconds after startup
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    console.log('🛑 Stopping OTP Cleanup Service');
    this.isRunning = false;
  }

  /**
   * Run cleanup manually
   */
  async runCleanup(): Promise<CleanupStats> {
    if (this.isRunning) {
      throw new Error('Cleanup is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let deletedOTPs = 0;
    let cleanedRedisKeys = 0;

    try {
      console.log('🧹 Starting OTP cleanup process...');

      // Clean up database records
      const dbCleanup = await this.cleanupDatabase();
      deletedOTPs = dbCleanup.deletedCount;

      // Clean up Redis keys
      const redisCleanup = await this.cleanupRedisKeys();
      cleanedRedisKeys = redisCleanup.cleanedCount;

      // Optimize database if significant cleanup occurred
      if (deletedOTPs > 100) {
        await this.optimizeDatabase();
      }

      const duration = Date.now() - startTime;
      const stats: CleanupStats = {
        timestamp: new Date(),
        deletedOTPs,
        cleanedRedisKeys,
        duration,
        errors
      };

      this.lastCleanup = stats;
      this.addToHistory(stats);

      if (this.config.logResults) {
        console.log(`✅ OTP cleanup completed in ${duration}ms:`, {
          deletedOTPs,
          cleanedRedisKeys,
          errors: errors.length
        });
      }

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      console.error('❌ OTP cleanup failed:', error);

      const duration = Date.now() - startTime;
      const stats: CleanupStats = {
        timestamp: new Date(),
        deletedOTPs,
        cleanedRedisKeys,
        duration,
        errors
      };

      this.lastCleanup = stats;
      this.addToHistory(stats);

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up expired OTP records from database
   */
  private async cleanupDatabase(): Promise<{ deletedCount: number }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete expired OTPs in batches
      let totalDeleted = 0;
      let batchDeleted = 0;

      do {
        const result = await client.query(`
          DELETE FROM otp_verifications 
          WHERE id IN (
            SELECT id FROM otp_verifications 
            WHERE (expires_at < CURRENT_TIMESTAMP - INTERVAL '${this.config.maxAge} hours'
                   OR (is_used = true AND created_at < CURRENT_TIMESTAMP - INTERVAL '${this.config.maxAge} hours'))
            LIMIT $1
          )
        `, [this.config.batchSize]);

        batchDeleted = result.rowCount || 0;
        totalDeleted += batchDeleted;

        // Small delay between batches to avoid overwhelming the database
        if (batchDeleted > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (batchDeleted > 0);

      await client.query('COMMIT');
      
      return { deletedCount: totalDeleted };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired Redis keys
   */
  private async cleanupRedisKeys(): Promise<{ cleanedCount: number }> {
    let cleanedCount = 0;

    try {
      // Get all OTP-related keys
      const otpKeys = await redisClient.keys('otp_*');
      const rateLimitKeys = await redisClient.keys('otp_rate_limit:*');
      const attemptKeys = await redisClient.keys('otp_attempts:*');

      const allKeys = [...otpKeys, ...rateLimitKeys, ...attemptKeys];

      // Check each key and remove if expired or orphaned
      for (const key of allKeys) {
        try {
          const ttl = await redisClient.ttl(key);
          
          // Remove keys that have expired or have no expiration set
          if (ttl === -1 || ttl === -2) {
            await redisClient.del(key);
            cleanedCount++;
          }
        } catch (error) {
          console.warn(`Failed to check/clean Redis key ${key}:`, error);
        }
      }

      return { cleanedCount };
    } catch (error) {
      console.error('Failed to cleanup Redis keys:', error);
      return { cleanedCount: 0 };
    }
  }

  /**
   * Optimize database after cleanup
   */
  private async optimizeDatabase(): Promise<void> {
    try {
      await pool.query('VACUUM ANALYZE otp_verifications');
    } catch (error) {
      console.warn('Failed to optimize database:', error);
    }
  }

  /**
   * Add cleanup stats to history
   */
  private addToHistory(stats: CleanupStats): void {
    this.cleanupHistory.push(stats);
    
    // Keep only last 100 cleanup records
    if (this.cleanupHistory.length > 100) {
      this.cleanupHistory = this.cleanupHistory.slice(-100);
    }
  }

  /**
   * Get cleanup history
   */
  getCleanupHistory(): CleanupStats[] {
    return [...this.cleanupHistory];
  }

  /**
   * Get last cleanup stats
   */
  getLastCleanup(): CleanupStats | undefined {
    return this.lastCleanup;
  }
}