import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { EmailVerification } from '../../shared/types';

export class SendGridEmailService {
  private readonly CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_HOURS = 24;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY environment variable is required');
    }
    sgMail.setApiKey(apiKey);
  }

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send email verification code using SendGrid
   */
  async sendVerificationCode(email: string, userId?: string): Promise<string> {
    const verificationCode = this.generateVerificationCode();
    const verificationId = uuidv4();
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store verification code in database
    await pool.query(`
      INSERT INTO email_verifications (id, user_id, email, verification_code, expires_at, verified_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [verificationId, userId, email, verificationCode, expiresAt, null, new Date()]);

    // Create email content
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
      subject: 'Email Verification Code',
      html: this.generateEmailTemplate(verificationCode),
      text: this.generateTextTemplate(verificationCode)
    };

    try {
      await sgMail.send(msg);
      console.log(`📧 Verification code sent to ${email}`);
      return verificationId;
    } catch (error) {
      console.error('SendGrid email send error:', error);
      // Clean up database entry if email fails
      await pool.query('DELETE FROM email_verifications WHERE id = $1', [verificationId]);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Verify email verification code
   */
  async verifyCode(verificationId: string, code: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT * FROM email_verifications 
      WHERE id = $1 AND verification_code = $2 AND verified_at IS NULL AND expires_at > NOW()
    `, [verificationId, code]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification code');
    }

    const verification = result.rows[0];

    // Mark as verified
    await pool.query(`
      UPDATE email_verifications SET verified_at = NOW() WHERE id = $1
    `, [verificationId]);

    // Update user email verification status if user_id exists
    if (verification.user_id) {
      await pool.query(`
        UPDATE users SET email_verified = true WHERE id = $1
      `, [verification.user_id]);
    }

    return true;
  }

  /**
   * Verify email by code without verification ID (for direct code verification)
   */
  async verifyEmailByCode(email: string, code: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT * FROM email_verifications 
      WHERE email = $1 AND verification_code = $2 AND verified_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [email, code]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification code');
    }

    const verification = result.rows[0];

    // Mark as verified
    await pool.query(`
      UPDATE email_verifications SET verified_at = NOW() WHERE id = $1
    `, [verification.id]);

    // Update user email verification status if user_id exists
    if (verification.user_id) {
      await pool.query(`
        UPDATE users SET email_verified = true WHERE id = $1
      `, [verification.user_id]);
    }

    return true;
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string, userId?: string): Promise<string> {
    // Check for recent verification attempts (rate limiting)
    const recentAttempt = await pool.query(`
      SELECT created_at FROM email_verifications 
      WHERE email = $1 AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC LIMIT 1
    `, [email]);

    if (recentAttempt.rows.length > 0) {
      throw new Error('Please wait before requesting a new verification code');
    }

    // Invalidate any existing unverified codes for this email
    await pool.query(`
      UPDATE email_verifications SET verified_at = NOW() 
      WHERE email = $1 AND verified_at IS NULL
    `, [email]);

    // Send new verification code
    return this.sendVerificationCode(email, userId);
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(verificationId: string): Promise<EmailVerification | null> {
    const result = await pool.query(`
      SELECT * FROM email_verifications WHERE id = $1
    `, [verificationId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      token: row.verification_code, // Using verification_code as token for compatibility
      expiresAt: new Date(row.expires_at),
      isUsed: row.verified_at !== null,
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Check if email is already verified
   */
  async isEmailVerified(email: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT verified_at FROM email_verifications 
      WHERE email = $1 AND verified_at IS NOT NULL
      ORDER BY verified_at DESC LIMIT 1
    `, [email]);

    return result.rows.length > 0;
  }

  /**
   * Clean up expired verification codes
   */
  async cleanupExpiredCodes(): Promise<void> {
    await pool.query(`
      DELETE FROM email_verifications WHERE expires_at < NOW()
    `);
  }

  /**
   * Generate HTML email template
   */
  private generateEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Email Verification</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
          <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
          
          <p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; display: inline-block;">
              ${code}
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This verification code will expire in ${this.CODE_EXPIRY_HOURS} hours.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't request this verification, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © 2024 Your Application. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email template
   */
  private generateTextTemplate(code: string): string {
    return `
      Email Verification
      
      Thank you for signing up! Please use the verification code below to verify your email address:
      
      Verification Code: ${code}
      
      This verification code will expire in ${this.CODE_EXPIRY_HOURS} hours.
      
      If you didn't request this verification, please ignore this email.
      
      © 2024 Your Application. All rights reserved.
    `;
  }
}