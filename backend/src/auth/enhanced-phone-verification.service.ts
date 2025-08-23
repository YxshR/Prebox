import { Twilio } from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../config/database';
import redisClient from '../config/redis';

export interface PhoneVerificationConfig {
  expiryMinutes: number;
  maxAttempts: number;
  rateLimitWindow: number; // minutes
  maxOTPsPerWindow: number;
  codeLength: number;
  resendCooldown: number; // seconds
}

export interface PhoneVerificationResult {
  otpId: string;
  expiresAt: Date;
  attemptsRemaining: number;
  cooldownUntil?: Date;
}

export interface PhoneVerificationValidation {
  isValid: boolean;
  userId?: string;
  attemptsRemaining: number;
  isExpired: boolean;
  isRateLimited: boolean;
  errorMessage?: string;
  canRetry: boolean;
}

export interface PhoneCheckResult {
  exists: boolean;
  userId?: string;
  isVerified?: boolean;
}

/**
 * Enhanced Phone Verification Service for multi-step signup flow
 * Implements requirements 1.2, 1.3, 1.4, 1.5 from auth-troubleshooting spec
 */
export class EnhancedPhoneVerificationService {
  private twilioClient: Twilio | null;
  private readonly config: PhoneVerificationConfig;
  private readonly isDemoMode: boolean;

  constructor(config?: Partial<PhoneVerificationConfig>) {
    this.config = {
      expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
      maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5'),
      rateLimitWindow: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || '300000') / 60000, // Convert to minutes
      maxOTPsPerWindow: parseInt(process.env.OTP_RATE_LIMIT_MAX_ATTEMPTS || '3'),
      codeLength: 6,
      resendCooldown: 60, // 1 minute
      ...config
    };

    this.isDemoMode = process.env.DEMO_MODE === 'true';
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken || this.isDemoMode || !accountSid.startsWith('AC')) {
      console.warn('⚠️ Twilio credentials not configured. Phone verification will use mock mode.');
      this.twilioClient = null;
    } else {
      this.twilioClient = new Twilio(accountSid, authToken);
    }
  }

  /**
   * Check if phone number already exists in database
   * Requirement 1.2: Check if phone number already exists
   */
  async checkPhoneExists(phone: string): Promise<PhoneCheckResult> {
    try {
      const result = await pool.query(
        'SELECT id, phone_verified FROM users WHERE phone = $1',
        [phone]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        return {
          exists: true,
          userId: user.id,
          isVerified: user.phone_verified
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking phone existence:', error);
      throw new Error('Failed to check phone number availability');
    }
  }

  /**
   * Start phone verification process
   * Requirement 1.4: Send OTP via SMS and store verification attempt
   */
  async startVerification(
    phone: string, 
    type: 'registration' | 'login' | 'password_reset',
    userId?: string
  ): Promise<PhoneVerificationResult> {
    // Check rate limiting first
    await this.checkRateLimit(phone);
    
    // For registration, check if phone already exists
    if (type === 'registration') {
      const phoneCheck = await this.checkPhoneExists(phone);
      if (phoneCheck.exists) {
        throw new Error('Phone number already registered. Please use login instead.');
      }
    }

    // Generate secure OTP
    const code = this.generateSecureCode();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + this.config.expiryMinutes * 60 * 1000);
    const hashedCode = this.hashOTPCode(code);

    // Store verification in database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert phone verification record
      await client.query(`
        INSERT INTO phone_verifications (
          id, phone, otp_code, expires_at, attempts, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [otpId, phone, hashedCode, expiresAt, 0, new Date()]);

      // Update rate limiting counter
      await this.updateRateLimitCounter(phone);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Send OTP via SMS
    await this.sendOTPSMS(phone, code, type);

    // Store attempt tracking in Redis
    const attemptKey = `phone_attempts:${phone}:${type}`;
    await redisClient.setEx(attemptKey, this.config.rateLimitWindow * 60, '0');

    return {
      otpId,
      expiresAt,
      attemptsRemaining: this.config.maxAttempts
    };
  }

  /**
   * Verify OTP code
   * Requirement 1.5: Verify OTP and allow retry without blocking
   * Requirement 1.6: Allow retry for incorrect OTP
   */
  async verifyOTP(otpId: string, code: string): Promise<PhoneVerificationValidation> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get verification record
      const otpResult = await client.query(`
        SELECT * FROM phone_verifications 
        WHERE id = $1 AND verified_at IS NULL
      `, [otpId]);

      if (otpResult.rows.length === 0) {
        return {
          isValid: false,
          attemptsRemaining: 0,
          isExpired: true,
          isRateLimited: false,
          canRetry: false,
          errorMessage: 'Verification not found or already completed'
        };
      }

      const verification = otpResult.rows[0];
      
      // Check expiration
      if (new Date() > new Date(verification.expires_at)) {
        await client.query('COMMIT');
        return {
          isValid: false,
          attemptsRemaining: 0,
          isExpired: true,
          isRateLimited: false,
          canRetry: true, // Allow new verification request
          errorMessage: 'Verification code has expired'
        };
      }

      // Check attempt limit
      if (verification.attempts >= this.config.maxAttempts) {
        await client.query('COMMIT');
        return {
          isValid: false,
          attemptsRemaining: 0,
          isExpired: false,
          isRateLimited: true,
          canRetry: true, // Allow new verification request
          errorMessage: 'Maximum attempts exceeded. Please request a new code.'
        };
      }

      // Increment attempt counter
      await client.query(`
        UPDATE phone_verifications 
        SET attempts = attempts + 1
        WHERE id = $1
      `, [otpId]);

      // Validate OTP code using timing-safe comparison
      const hashedCode = this.hashOTPCode(code);
      const isValidCode = crypto.timingSafeEqual(
        Buffer.from(verification.otp_code, 'hex'),
        Buffer.from(hashedCode, 'hex')
      );

      const attemptsRemaining = this.config.maxAttempts - (verification.attempts + 1);

      if (isValidCode) {
        // Mark verification as completed
        await client.query(`
          UPDATE phone_verifications 
          SET verified_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [otpId]);

        // Clear rate limiting
        const attemptKey = `phone_attempts:${verification.phone}:*`;
        const keys = await redisClient.keys(attemptKey);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }

        await client.query('COMMIT');
        
        return {
          isValid: true,
          attemptsRemaining: this.config.maxAttempts,
          isExpired: false,
          isRateLimited: false,
          canRetry: false
        };
      } else {
        await client.query('COMMIT');
        
        return {
          isValid: false,
          attemptsRemaining,
          isExpired: false,
          isRateLimited: attemptsRemaining <= 0,
          canRetry: true, // Always allow retry for incorrect codes
          errorMessage: attemptsRemaining > 0 
            ? `Invalid verification code. ${attemptsRemaining} attempts remaining.`
            : 'Invalid verification code. Maximum attempts exceeded. Please request a new code.'
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
   * Resend OTP with cooldown protection
   */
  async resendOTP(otpId: string): Promise<PhoneVerificationResult> {
    const verificationResult = await pool.query(`
      SELECT * FROM phone_verifications WHERE id = $1 AND verified_at IS NULL
    `, [otpId]);

    if (verificationResult.rows.length === 0) {
      throw new Error('Verification not found or already completed');
    }

    const verification = verificationResult.rows[0];
    
    // Check cooldown period
    const timeSinceCreated = Date.now() - new Date(verification.created_at).getTime();
    if (timeSinceCreated < this.config.resendCooldown * 1000) {
      const remainingCooldown = Math.ceil((this.config.resendCooldown * 1000 - timeSinceCreated) / 1000);
      throw new Error(`Please wait ${remainingCooldown} seconds before requesting a new code`);
    }

    // Check rate limiting
    await this.checkRateLimit(verification.phone);

    // Mark old verification as expired
    await pool.query(`
      UPDATE phone_verifications 
      SET expires_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [otpId]);

    // Create new verification
    return this.startVerification(verification.phone, 'registration');
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(otpId: string): Promise<{
    exists: boolean;
    isExpired: boolean;
    isVerified: boolean;
    attemptsRemaining: number;
    expiresAt?: Date;
  }> {
    const result = await pool.query(`
      SELECT * FROM phone_verifications WHERE id = $1
    `, [otpId]);

    if (result.rows.length === 0) {
      return {
        exists: false,
        isExpired: false,
        isVerified: false,
        attemptsRemaining: 0
      };
    }

    const verification = result.rows[0];
    const isExpired = new Date() > new Date(verification.expires_at);
    const isVerified = verification.verified_at !== null;
    const attemptsRemaining = Math.max(0, this.config.maxAttempts - verification.attempts);

    return {
      exists: true,
      isExpired,
      isVerified,
      attemptsRemaining,
      expiresAt: new Date(verification.expires_at)
    };
  }

  /**
   * Clean up expired verifications
   */
  async cleanupExpiredVerifications(): Promise<{ deletedCount: number }> {
    const result = await pool.query(`
      DELETE FROM phone_verifications 
      WHERE expires_at < CURRENT_TIMESTAMP OR verified_at IS NOT NULL
    `);

    return { deletedCount: result.rowCount || 0 };
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
    return crypto.createHash('sha256')
      .update(code + (process.env.JWT_SECRET || 'default-secret'))
      .digest('hex');
  }

  /**
   * Check rate limiting for phone number
   */
  private async checkRateLimit(phone: string): Promise<void> {
    const rateLimitKey = `phone_rate_limit:${phone}`;
    const currentCount = await redisClient.get(rateLimitKey);
    
    if (currentCount && parseInt(currentCount) >= this.config.maxOTPsPerWindow) {
      const ttl = await redisClient.ttl(rateLimitKey);
      throw new Error(`Too many verification attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`);
    }
  }

  /**
   * Update rate limiting counter
   */
  private async updateRateLimitCounter(phone: string): Promise<void> {
    const rateLimitKey = `phone_rate_limit:${phone}`;
    const current = await redisClient.get(rateLimitKey);
    
    if (current) {
      await redisClient.incr(rateLimitKey);
    } else {
      await redisClient.setEx(rateLimitKey, this.config.rateLimitWindow * 60, '1');
    }
  }

  /**
   * Send OTP via SMS using Twilio
   */
  private async sendOTPSMS(phone: string, code: string, type: string): Promise<void> {
    const message = this.formatOTPMessage(code, type);
    
    try {
      if (this.twilioClient) {
        await this.twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        console.log(`📱 Phone verification OTP sent to ${phone}`);
      } else {
        // Mock mode for development
        console.log(`📱 [MOCK] Phone verification OTP for ${phone}: ${code}`);
      }
    } catch (error) {
      console.error('Failed to send phone verification SMS:', error);
      throw new Error('Failed to send verification code. Please try again.');
    }
  }

  /**
   * Format OTP message based on verification type
   */
  private formatOTPMessage(code: string, type: string): string {
    const messages = {
      registration: `Your signup verification code is: ${code}. This code expires in ${this.config.expiryMinutes} minutes. Do not share this code.`,
      login: `Your login verification code is: ${code}. This code expires in ${this.config.expiryMinutes} minutes. Do not share this code.`,
      password_reset: `Your password reset code is: ${code}. This code expires in ${this.config.expiryMinutes} minutes. Do not share this code.`
    };
    
    return messages[type as keyof typeof messages] || 
           `Your verification code is: ${code}. Expires in ${this.config.expiryMinutes} minutes.`;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    database: boolean;
    redis: boolean;
    twilio: boolean;
    activeVerifications: number;
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
      
      // Get active verification count
      const activeResult = await pool.query(`
        SELECT COUNT(*) as count FROM phone_verifications 
        WHERE verified_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      `);
      const activeVerifications = parseInt(activeResult.rows[0].count);
      
      return {
        database: dbHealth,
        redis: redisHealth,
        twilio: twilioHealth,
        activeVerifications
      };
    } catch (error) {
      console.error('Phone verification service health check failed:', error);
      return {
        database: false,
        redis: false,
        twilio: false,
        activeVerifications: 0
      };
    }
  }
}

export default EnhancedPhoneVerificationService;