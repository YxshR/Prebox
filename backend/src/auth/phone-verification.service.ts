import { Twilio } from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import redisClient from '../config/redis';
import { OTPVerification } from '../shared/types';

export class PhoneVerificationService {
  private twilioClient: Twilio;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const isDemoMode = process.env.DEMO_MODE === 'true';
    
    if (!accountSid || !authToken || isDemoMode || !accountSid.startsWith('AC')) {
      console.warn('⚠️ Twilio credentials not configured. Phone verification will use mock mode.');
      this.twilioClient = null as any;
    } else {
      this.twilioClient = new Twilio(accountSid, authToken);
    }
  }

  async sendOTP(userId: string, phone: string, type: 'registration' | 'login' | 'password_reset'): Promise<string> {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    await pool.query(`
      INSERT INTO otp_verifications (id, user_id, phone, code, type, expires_at, is_used, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [otpId, userId, phone, code, type, expiresAt, false, new Date()]);

    // Store attempt count in Redis
    const attemptKey = `otp_attempts:${phone}:${type}`;
    const currentAttempts = await redisClient.get(attemptKey);
    const attempts = currentAttempts ? parseInt(currentAttempts) + 1 : 1;
    
    if (attempts > this.MAX_ATTEMPTS) {
      throw new Error('Maximum OTP attempts exceeded. Please try again later.');
    }
    
    await redisClient.setEx(attemptKey, 60 * 60, attempts.toString()); // 1 hour expiry

    // Send SMS
    try {
      if (this.twilioClient) {
        await this.twilioClient.messages.create({
          body: `Your verification code is: ${code}. This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        console.log(`📱 OTP sent to ${phone}`);
      } else {
        // Mock mode for development
        console.log(`📱 [MOCK] OTP for ${phone}: ${code}`);
      }
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw new Error('Failed to send verification code');
    }

    return otpId;
  }

  async verifyOTP(otpId: string, code: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT * FROM otp_verifications 
      WHERE id = $1 AND code = $2 AND is_used = false AND expires_at > NOW()
    `, [otpId, code]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification code');
    }

    const otp = result.rows[0];

    // Mark OTP as used
    await pool.query(`
      UPDATE otp_verifications SET is_used = true WHERE id = $1
    `, [otpId]);

    // Update user phone verification status
    if (otp.type === 'registration') {
      await pool.query(`
        UPDATE users SET is_phone_verified = true WHERE id = $1
      `, [otp.user_id]);
    }

    // Clear attempt count
    const attemptKey = `otp_attempts:${otp.phone}:${otp.type}`;
    await redisClient.del(attemptKey);

    return true;
  }

  async verifyOTPWithAuth(otpId: string, code: string): Promise<any> {
    const result = await pool.query(`
      SELECT ov.*, u.* FROM otp_verifications ov
      JOIN users u ON ov.user_id = u.id
      WHERE ov.id = $1 AND ov.code = $2 AND ov.is_used = false AND ov.expires_at > NOW()
    `, [otpId, code]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification code');
    }

    const otp = result.rows[0];

    // Mark OTP as used
    await pool.query(`
      UPDATE otp_verifications SET is_used = true WHERE id = $1
    `, [otpId]);

    // Update user phone verification status
    if (otp.type === 'registration') {
      await pool.query(`
        UPDATE users SET is_phone_verified = true, last_login_at = $1 WHERE id = $2
      `, [new Date(), otp.user_id]);
    }

    // Clear attempt count
    const attemptKey = `otp_attempts:${otp.phone}:${otp.type}`;
    await redisClient.del(attemptKey);

    // Import AuthService to generate tokens
    const { AuthService } = await import('./auth.service');
    const authService = new AuthService();

    // Map user data
    const user = {
      id: otp.id,
      email: otp.email,
      phone: otp.phone,
      firstName: otp.first_name,
      lastName: otp.last_name,
      tenantId: otp.tenant_id,
      role: otp.role,
      subscriptionTier: otp.subscription_tier,
      isEmailVerified: otp.is_email_verified,
      isPhoneVerified: true, // Just verified
      googleId: otp.google_id,
      createdAt: new Date(otp.created_at),
      lastLoginAt: new Date()
    };

    // Generate tokens using user-specific secrets
    const { UserSecurityManager } = await import('./user-security-manager.service');
    const userSecurityManager = new UserSecurityManager();
    
    // Ensure user has JWT secrets
    await userSecurityManager.ensureUserJWTSecrets(user.id);
    
    const accessToken = await userSecurityManager.generateUserAccessToken(user);
    const refreshToken = await userSecurityManager.generateUserRefreshToken(user);

    // Store refresh token in Redis
    await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user
    };
  }

  async resendOTP(otpId: string): Promise<string> {
    const result = await pool.query(`
      SELECT * FROM otp_verifications WHERE id = $1 AND is_used = false
    `, [otpId]);

    if (result.rows.length === 0) {
      throw new Error('OTP not found or already used');
    }

    const otp = result.rows[0];
    
    // Check if enough time has passed (prevent spam)
    const timeSinceCreated = Date.now() - new Date(otp.created_at).getTime();
    if (timeSinceCreated < 60000) { // 1 minute
      throw new Error('Please wait before requesting a new code');
    }

    // Mark old OTP as used
    await pool.query(`
      UPDATE otp_verifications SET is_used = true WHERE id = $1
    `, [otpId]);

    // Send new OTP
    return this.sendOTP(otp.user_id, otp.phone, otp.type);
  }

  async getOTPStatus(otpId: string): Promise<OTPVerification | null> {
    const result = await pool.query(`
      SELECT * FROM otp_verifications WHERE id = $1
    `, [otpId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      phone: row.phone,
      code: row.code,
      type: row.type,
      expiresAt: new Date(row.expires_at),
      isUsed: row.is_used,
      createdAt: new Date(row.created_at)
    };
  }

  async cleanupExpiredOTPs(): Promise<void> {
    await pool.query(`
      DELETE FROM otp_verifications WHERE expires_at < NOW()
    `);
  }
}