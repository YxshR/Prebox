import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { User, UserRole, SubscriptionTier } from '../shared/types';
import { AuthService } from './auth.service';

export class GoogleOAuthService {
  private authService: AuthService;
  private isDemoMode: boolean;

  constructor() {
    this.authService = new AuthService();
    this.isDemoMode = process.env.DEMO_MODE === 'true';
    
    if (!this.isDemoMode) {
      this.configurePassport();
    }
  }

  private configurePassport(): void {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientID || !clientSecret) {
      console.warn('⚠️ Google OAuth credentials not configured. Google login will be disabled.');
      return;
    }

    passport.use(new GoogleStrategy({
      clientID,
      clientSecret,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await this.handleGoogleAuth(profile);
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }));

    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length > 0) {
          const user = this.mapRowToUser(result.rows[0]);
          done(null, user);
        } else {
          done(new Error('User not found'), null);
        }
      } catch (error) {
        done(error, null);
      }
    });
  }

  private async handleGoogleAuth(profile: any): Promise<User> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user exists with Google ID
      let userResult = await client.query(
        'SELECT * FROM users WHERE google_id = $1',
        [profile.id]
      );

      if (userResult.rows.length > 0) {
        // User exists, update last login
        await client.query(
          'UPDATE users SET last_login_at = $1 WHERE id = $2',
          [new Date(), userResult.rows[0].id]
        );
        
        await client.query('COMMIT');
        return this.mapRowToUser(userResult.rows[0]);
      }

      // Check if user exists with same email
      const email = profile.emails?.[0]?.value;
      if (email) {
        userResult = await client.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (userResult.rows.length > 0) {
          // Link Google account to existing user
          await client.query(
            'UPDATE users SET google_id = $1, is_email_verified = true, last_login_at = $2 WHERE id = $3',
            [profile.id, new Date(), userResult.rows[0].id]
          );
          
          await client.query('COMMIT');
          return this.mapRowToUser({
            ...userResult.rows[0],
            google_id: profile.id,
            is_email_verified: true,
            last_login_at: new Date()
          });
        }
      }

      // Create new user
      const userId = uuidv4();
      const tenantId = uuidv4();
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';

      if (!email) {
        throw new Error('Email is required from Google profile');
      }

      const newUserResult = await client.query(`
        INSERT INTO users (
          id, email, first_name, last_name, tenant_id, role, 
          subscription_tier, is_email_verified, is_phone_verified, 
          google_id, created_at, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        userId,
        email,
        firstName,
        lastName,
        tenantId,
        UserRole.USER,
        SubscriptionTier.FREE,
        true, // Email is verified via Google
        false,
        profile.id,
        new Date(),
        new Date()
      ]);

      // Create tenant record
      await client.query(`
        INSERT INTO tenants (id, name, created_at)
        VALUES ($1, $2, $3)
      `, [tenantId, email, new Date()]);

      // Create default subscription
      await client.query(`
        INSERT INTO subscriptions (
          id, tenant_id, plan_id, status, current_period_start, 
          current_period_end, daily_email_limit, monthly_recipient_limit,
          monthly_email_limit, template_limit, custom_domain_limit,
          recharge_balance, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        uuidv4(),
        tenantId,
        'free',
        'active',
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        100, // Free tier: 100 emails/day
        300, // Free tier: 300 recipients/month
        2000, // Free tier: 2000 emails/month
        1, // Free tier: 1 AI template/day
        0, // Free tier: no custom domains
        0, // No recharge balance
        new Date()
      ]);

      await client.query('COMMIT');
      return this.mapRowToUser(newUserResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getAuthUrl(): string {
    return '/auth/google';
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      firstName: row.first_name,
      lastName: row.last_name,
      tenantId: row.tenant_id,
      role: row.role as UserRole,
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      isEmailVerified: row.is_email_verified,
      isPhoneVerified: row.is_phone_verified,
      googleId: row.google_id,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : new Date()
    };
  }
}