import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../config/database';
import redisClient from '../config/redis';
import { Twilio } from 'twilio';

export interface SecureOTPConfig {
  expiryMinutes: number;
  maxAttempts: number;
  rateLimitWindow: number; // minutes
  maxOTPsPerWindow: number;
  codeLength: number;
}

export interface OTPGenerationResult {
  otpId: string;
  expiresAt: Date;
  attemptsRemaining: number;
}

export interface OTPValidationResult {
  isValid: boolean;
  userId?: string;
  attemptsRemaining: number;
  isExpired: boolean;
  isRateLimited: boolean;
  errorMessage?: string;
}

export interface OTPAttemptInfo {
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date;
  isBlocked: boolean;
  blockExpiresAt?: Date;
}

/**
 * Enhanced secure OTP management service with comprehensive security features
 */
export class SecureOTPService {
  private twilioClient: Twilio | null;
  private readonly config: SecureOTPConfig;
  private readonly isDemoMode: boolean;

  constructor(config?: Partial<SecureOTPConfig>) {
    this.config = {
      expiryMinutes: 10,
      maxAttempts: 3,
      rateLimitWindow: 60, // 1 hour
      maxOTPsPerWindow: 5,
      codeLength: 6,
      ...config
    };

    this.isDemoMode = process.env.DEMO_MODE === 'true';
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken || this.isDemoMode || !accountSid.startsWith('AC')) {
      console.warn('⚠️ Twilio credentials not configured. OTP service will use mock mode.');
      this.twilioClient = null;
    } else {
      this.twilioClient = new Twilio(accountSid, authToken);
    }
  }

  /**
   * Generate and send secure OTP with enhanced security measures
   */
  async generateOTP(
    phoneNumber: string, 
    type: 'registration' | 'login' | 'password_reset',
    userId?: string
  ): Promise<OTPGenerationResult> {
    // Check rate limiting
    await this.checkRateLimit(phoneNumber);
    
    // Generate cryptographically secure OTP
    const code = this.generateSecureCode();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + this.config.expiryMinutes * 60 * 1000);
    const hashedCode = this.hashOTPCode(code);

    // Store OTP in database with enhanced security
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert OTP record
      await client.query(`
        INSERT INTO otp_verifications (
          id, user_id, phone_number, otp_code, type, expires_at, 
          attempts, max_attempts, is_used, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        otpId, userId || null, phoneNumber, hashedCode, type, expiresAt,
        0, this.config.maxAttempts, false, new Date()
      ]);

      // Update rate limiting counter
      await this.updateRateLimitCounter(phoneNumber);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Send OTP via SMS
    await this.sendOTPSMS(phoneNumber, code, type);

    // Store attempt tracking in Redis
    const attemptKey = `otp_attempts:${phoneNumber}:${type}`;
    await redisClient.setEx(attemptKey, this.config.rateLimitWindow * 60, '0');

    return {
      otpId,
      expiresAt,
      attemptsRemaining: this.config.maxAttempts
    };
  }

  /**
   * Validate OTP with comprehensive security checks
   */
  async validateOTP(otpId: string, code: string): Promise<OTPValidationResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get OTP record
      const otpResult = await client.query(`
        SELECT * FROM otp_verifications 
        WHERE id = $1 AND is_used = false
      `, [otpId]);

      if (otpResult.rows.length === 0) {
        return {
          isValid: false,
          attemptsRemaining: 0,
          isExpired: true,
          isRateLimited: false,
          errorMessage: 'OTP not found or already used'
        };
      }

      const otp = otpResult.rows[0];
      
      // Check expiration
      if (new Date() > new Date(otp.expires_at)) {
        await client.query(`
          UPDATE otp_verifications SET is_used = true WHERE id = $1
        `, [otpId]);
        
        await client.query('COMMIT');
        return {
          isValid: false,
          attemptsRemaining: 0,
          isExpired: true,
          isRateLimited: false,
          errorMessage: 'OTP has expired'
        };
      }

      // Check attempt limit
      if (otp.attempts >= otp.max_attempts) {
        await client.query(`
          UPDATE otp_verifications SET is_used = true WHERE id = $1
        `, [otpId]);
        
        await client.query('COMMIT');
        return {
          isValid: false,
          attemptsRemaining: 0,
          isExpired: false,
          isRateLimited: true,
          errorMessage: 'Maximum attempts exceeded'
        };
      }

      // Increment attempt counter
      await client.query(`
        UPDATE otp_verifications 
        SET attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [otpId]);

      // Validate OTP code
      const hashedCode = this.hashOTPCode(code);
      const isValidCode = crypto.timingSafeEqual(
        Buffer.from(otp.otp_code, 'hex'),
        Buffer.from(hashedCode, 'hex')
      );

      const attemptsRemaining = otp.max_attempts - (otp.attempts + 1);

      if (isValidCode) {
        // Mark OTP as used
        await client.query(`
          UPDATE otp_verifications SET is_used = true WHERE id = $1
        `, [otpId]);

        // Update user verification status if registration
        if (otp.type === 'registration' && otp.user_id) {
          await client.query(`
            UPDATE users SET is_phone_verified = true WHERE id = $1
          `, [otp.user_id]);
        }

        // Clear rate limiting
        const attemptKey = `otp_attempts:${otp.phone_number}:${otp.type}`;
        await redisClient.del(attemptKey);

        await client.query('COMMIT');
        
        return {
          isValid: true,
          userId: otp.user_id,
          attemptsRemaining: this.config.maxAttempts,
          isExpired: false,
          isRateLimited: false
        };
      } else {
        await client.query('COMMIT');
        
        return {
          isValid: false,
          attemptsRemaining,
          isExpired: false,
          isRateLimited: attemptsRemaining <= 0,
          errorMessage: attemptsRemaining > 0 
            ? `Invalid OTP. ${attemptsRemaining} attempts remaining.`
            : 'Invalid OTP. Maximum attempts exceeded.'
        };
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resend OTP with security checks
   */
  async resendOTP(otpId: string): Promise<OTPGenerationResult> {
    const otpResult = await pool.query(`
      SELECT * FROM otp_verifications WHERE id = $1 AND is_used = false
    `, [otpId]);

    if (otpResult.rows.length === 0) {
      throw new Error('OTP not found or already used');
    }

    const otp = otpResult.rows[0];
    
    // Check if enough time has passed (prevent spam)
    const timeSinceCreated = Date.now() - new Date(otp.created_at).getTime();
    if (timeSinceCreated < 60000) { // 1 minute
      throw new Error('Please wait before requesting a new code');
    }

    // Check rate limiting
    await this.checkRateLimit(otp.phone_number);

    // Mark old OTP as used
    await pool.query(`
      UPDATE otp_verifications SET is_used = true WHERE id = $1
    `, [otpId]);

    // Generate new OTP
    return this.generateOTP(otp.phone_number, otp.type, otp.user_id);
  }

  /**
   * Get OTP attempt information
   */
  async getOTPAttemptInfo(phoneNumber: string, type: string): Promise<OTPAttemptInfo> {
    const result = await pool.query(`
      SELECT attempts, max_attempts, last_attempt_at, created_at
      FROM otp_verifications 
      WHERE phone_number = $1 AND type = $2 AND is_used = false
      ORDER BY created_at DESC
      LIMIT 1
    `, [phoneNumber, type]);

    if (result.rows.length === 0) {
      return {
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        lastAttemptAt: new Date(),
        isBlocked: false
      };
    }

    const otp = result.rows[0];
    const isBlocked = otp.attempts >= otp.max_attempts;
    
    return {
      attempts: otp.attempts,
      maxAttempts: otp.max_attempts,
      lastAttemptAt: new Date(otp.last_attempt_at || otp.created_at),
      isBlocked,
      blockExpiresAt: isBlocked ? new Date(otp.created_at.getTime() + this.config.rateLimitWindow * 60 * 1000) : undefined
    };
  }

  /**
   * Clean up expired OTPs and related data
   */
  async cleanupExpiredOTPs(): Promise<{ deletedCount: number; cleanedRedisKeys: number }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get expired OTPs for Redis cleanup
      const expiredOTPs = await client.query(`
        SELECT phone_number, type FROM otp_verifications 
        WHERE expires_at < CURRENT_TIMESTAMP OR is_used = true
      `);

      // Delete expired OTPs from database
      const deleteResult = await client.query(`
        DELETE FROM otp_verifications 
        WHERE expires_at < CURRENT_TIMESTAMP OR is_used = true
      `);

      await client.query('COMMIT');

      // Clean up Redis keys
      let cleanedRedisKeys = 0;
      for (const otp of expiredOTPs.rows) {
        const attemptKey = `otp_attempts:${otp.phone_number}:${otp.type}`;
        const rateLimitKey = `otp_rate_limit:${otp.phone_number}`;
        
        try {
          await redisClient.del(attemptKey);
          await redisClient.del(rateLimitKey);
          cleanedRedisKeys += 2;
        } catch (error) {
          console.error('Failed to clean Redis key:', error);
        }
      }

      return {
        deletedCount: deleteResult.rowCount || 0,
        cleanedRedisKeys
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate cryptographically secure OTP code
   */
  private generateSecureCode(): string {
    const max = Math.pow(10, this.config.codeLength) - 1;
    const min = Math.pow(10, this.config.codeLength - 1);
    
    let code: number;
    do {
      const randomBytes = crypto.randomBytes(4);
      code = randomBytes.readUInt32BE(0) % (max - min + 1) + min;
    } while (code < min || code > max);
    
    return code.toString().padStart(this.config.codeLength, '0');
  }

  /**
   * Hash OTP code for secure storage
   */
  private hashOTPCode(code: string): string {
    return crypto.createHash('sha256').update(code + process.env.JWT_SECRET).digest('hex');
  }

  /**
   * Check rate limiting for OTP generation
   */
  private async checkRateLimit(phoneNumber: string): Promise<void> {
    const rateLimitKey = `otp_rate_limit:${phoneNumber}`;
    const currentCount = await redisClient.get(rateLimitKey);
    
    if (currentCount && parseInt(currentCount) >= this.config.maxOTPsPerWindow) {
      const ttl = await redisClient.ttl(rateLimitKey);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(ttl / 60)} minutes.`);
    }
  }

  /**
   * Update rate limiting counter
   */
  private async updateRateLimitCounter(phoneNumber: string): Promise<void> {
    const rateLimitKey = `otp_rate_limit:${phoneNumber}`;
    const current = await redisClient.get(rateLimitKey);
    
    if (current) {
      await redisClient.incr(rateLimitKey);
    } else {
      await redisClient.setEx(rateLimitKey, this.config.rateLimitWindow * 60, '1');
    }
  }

  /**
   * Send OTP via SMS
   */
  private async sendOTPSMS(phoneNumber: string, code: string, type: string): Promise<void> {
    const message = this.formatOTPMessage(code, type);
    
    try {
      if (this.twilioClient) {
        await this.twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
        console.log(`📱 Secure OTP sent to ${phoneNumber}`);
      } else {
        // Mock mode for development
        console.log(`📱 [MOCK] Secure OTP for ${phoneNumber}: ${code}`);
      }
    } catch (error) {
      console.error('Failed to send secure OTP SMS:', error);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Format OTP message based on type
   */
  private formatOTPMessage(code: string, type: string): string {
    const messages = {
      registration: `Your Perbox registration code is: ${code}. This code expires in ${this.config.expiryMinutes} minutes. Do not share this code.`,
      login: `Your Perbox login code is: ${code}. This code expires in ${this.config.expiryMinutes} minutes. Do not share this code.`,
      password_reset: `Your Perbox password reset code is: ${code}. This code expires in ${this.config.expiryMinutes} minutes. Do not share this code.`
    };
    
    return messages[type as keyof typeof messages] || `Your verification code is: ${code}`;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    database: boolean;
    redis: boolean;
    twilio: boolean;
    activeOTPs: number;
  }> {
    try {
      // Test database
      await pool.query('SELECT 1');
      const dbHealth = true;
      
      // Test Redis
      await redisClient.ping();
      const redisHealth = true;
      
      // Test Twilio (if configured)
      let twilioHealth = true;
      if (this.twilioClient && !this.isDemoMode) {
        try {
          await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
        } catch {
          twilioHealth = false;
        }
      }
      
      // Get active OTP count
      const activeOTPsResult = await pool.query(`
        SELECT COUNT(*) as count FROM otp_verifications 
        WHERE is_used = false AND expires_at > CURRENT_TIMESTAMP
      `);
      const activeOTPs = parseInt(activeOTPsResult.rows[0].count);
      
      return {
        database: dbHealth,
        redis: redisHealth,
        twilio: twilioHealth,
        activeOTPs
      };
    } catch (error) {
      console.error('OTP service health check failed:', error);
      return {
        database: false,
        redis: false,
        twilio: false,
        activeOTPs: 0
      };
    }
  }
}

export default SecureOTPService;