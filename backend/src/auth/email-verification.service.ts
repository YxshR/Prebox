import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../config/database';
import { EmailVerification } from '../shared/types';

export class EmailVerificationService {
  private transporter: nodemailer.Transporter;
  private readonly TOKEN_EXPIRY_HOURS = 24;

  constructor() {
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.warn('⚠️ Email transporter configuration error:', error.message);
      } else {
        console.log('✅ Email transporter ready');
      }
    });
  }

  async sendVerificationEmail(userId: string, email: string): Promise<string> {
    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const verificationId = uuidv4();
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store verification token in database
    await pool.query(`
      INSERT INTO email_verifications (id, user_id, email, token, expires_at, is_used, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [verificationId, userId, email, token, expiresAt, false, new Date()]);

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    // Email template
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@bulkemailplatform.com',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Bulk Email Platform!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            
            <p>Thank you for signing up! Please click the button below to verify your email address and activate your account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold;
                        display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, you can copy and paste this link into your browser:
              <br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              This verification link will expire in ${this.TOKEN_EXPIRY_HOURS} hours.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you didn't create an account with us, please ignore this email.
              <br>
              © 2024 Bulk Email Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Bulk Email Platform!
        
        Thank you for signing up! Please verify your email address by visiting this link:
        ${verificationUrl}
        
        This verification link will expire in ${this.TOKEN_EXPIRY_HOURS} hours.
        
        If you didn't create an account with us, please ignore this email.
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Verification email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }

    return verificationId;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT * FROM email_verifications 
      WHERE token = $1 AND is_used = false AND expires_at > NOW()
    `, [token]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    const verification = result.rows[0];

    // Mark token as used
    await pool.query(`
      UPDATE email_verifications SET is_used = true WHERE id = $1
    `, [verification.id]);

    // Update user email verification status
    await pool.query(`
      UPDATE users SET is_email_verified = true WHERE id = $1
    `, [verification.user_id]);

    return true;
  }

  async resendVerificationEmail(userId: string): Promise<string> {
    // Get user email
    const userResult = await pool.query(`
      SELECT email FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const email = userResult.rows[0].email;

    // Check if there's a recent verification email (prevent spam)
    const recentVerification = await pool.query(`
      SELECT created_at FROM email_verifications 
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    if (recentVerification.rows.length > 0) {
      throw new Error('Please wait before requesting a new verification email');
    }

    // Mark any existing unused tokens as used
    await pool.query(`
      UPDATE email_verifications SET is_used = true 
      WHERE user_id = $1 AND is_used = false
    `, [userId]);

    // Send new verification email
    return this.sendVerificationEmail(userId, email);
  }

  async getVerificationStatus(token: string): Promise<EmailVerification | null> {
    const result = await pool.query(`
      SELECT * FROM email_verifications WHERE token = $1
    `, [token]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      isUsed: row.is_used,
      createdAt: new Date(row.created_at)
    };
  }

  async cleanupExpiredTokens(): Promise<void> {
    await pool.query(`
      DELETE FROM email_verifications WHERE expires_at < NOW()
    `);
  }
}