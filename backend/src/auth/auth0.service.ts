import { ManagementClient, AuthenticationClient } from 'auth0';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { PhoneVerificationService } from './phone-verification.service';
import { AuthService } from './auth.service';
import { 
  Auth0Profile, 
  Auth0UserProfile, 
  Auth0SignupRequest, 
  Auth0CallbackResult,
  User,
  UserRole,
  SubscriptionTier,
  AuthToken
} from '../shared/types';

export class Auth0Service {
  private managementClient: ManagementClient;
  private authenticationClient: AuthenticationClient;
  private phoneVerificationService: PhoneVerificationService;
  public authService: AuthService;

  constructor() {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    if (!domain || !clientId || !clientSecret) {
      throw new Error('Auth0 configuration is missing. Please check AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET environment variables.');
    }

    this.managementClient = new ManagementClient({
      domain,
      clientId: clientId,
      clientSecret: clientSecret
    });

    this.authenticationClient = new AuthenticationClient({
      domain,
      clientId,
      clientSecret
    });

    this.phoneVerificationService = new PhoneVerificationService();
    this.authService = new AuthService();
  }

  /**
   * Handle Auth0 callback and create/login user
   */
  async handleAuth0Callback(auth0Profile: Auth0UserProfile): Promise<Auth0CallbackResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already exists by Auth0 ID
      let existingUserResult = await client.query(
        'SELECT * FROM users WHERE auth0_id = $1',
        [auth0Profile.sub]
      );

      if (existingUserResult.rows.length > 0) {
        // User exists, update last login and return
        const user = this.mapRowToUser(existingUserResult.rows[0]);
        
        await client.query(
          'UPDATE users SET last_login_at = $1 WHERE id = $2',
          [new Date(), user.id]
        );

        await client.query('COMMIT');

        return {
          user: { ...user, lastLoginAt: new Date() },
          isNewUser: false,
          requiresPhoneVerification: false
        };
      }

      // Check if user exists by email
      existingUserResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [auth0Profile.email]
      );

      if (existingUserResult.rows.length > 0) {
        // Email exists but no Auth0 ID - link accounts
        const userId = existingUserResult.rows[0].id;
        
        await client.query(
          'UPDATE users SET auth0_id = $1, last_login_at = $2 WHERE id = $3',
          [auth0Profile.sub, new Date(), userId]
        );

        // Create or update Auth0 profile record
        await this.upsertAuth0Profile(client, userId, auth0Profile);

        await client.query('COMMIT');

        const user = this.mapRowToUser({
          ...existingUserResult.rows[0],
          auth0_id: auth0Profile.sub,
          last_login_at: new Date()
        });

        return {
          user,
          isNewUser: false,
          requiresPhoneVerification: !user.isPhoneVerified
        };
      }

      // Create new user
      const userId = uuidv4();
      const tenantId = uuidv4();

      const userResult = await client.query(`
        INSERT INTO users (
          id, email, first_name, last_name, auth0_id, tenant_id, 
          role, subscription_tier, is_email_verified, is_phone_verified, 
          created_at, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        userId,
        auth0Profile.email,
        auth0Profile.given_name || null,
        auth0Profile.family_name || null,
        auth0Profile.sub,
        tenantId,
        UserRole.USER,
        SubscriptionTier.FREE,
        auth0Profile.email_verified || false,
        false, // Phone not verified yet
        new Date(),
        new Date()
      ]);

      // Create tenant record
      await client.query(`
        INSERT INTO tenants (id, name, created_at)
        VALUES ($1, $2, $3)
      `, [tenantId, auth0Profile.email, new Date()]);

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

      // Create Auth0 profile record
      await this.upsertAuth0Profile(client, userId, auth0Profile);

      await client.query('COMMIT');

      const user = this.mapRowToUser(userResult.rows[0]);

      return {
        user,
        isNewUser: true,
        requiresPhoneVerification: true
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Complete Auth0 signup with phone verification
   */
  async completeAuth0Signup(userId: string, phone: string): Promise<{ otpId: string }> {
    const client = await pool.connect();
    
    try {
      // Check if phone number is already in use
      const existingPhone = await client.query(
        'SELECT id FROM users WHERE phone = $1 AND id != $2',
        [phone, userId]
      );

      if (existingPhone.rows.length > 0) {
        throw new Error('Phone number is already registered with another account');
      }

      // Update user with phone number
      await client.query(
        'UPDATE users SET phone = $1 WHERE id = $2',
        [phone, userId]
      );

      // Send OTP for phone verification
      const otpId = await this.phoneVerificationService.sendOTP(userId, phone, 'registration');

      return { otpId };

    } finally {
      client.release();
    }
  }

  /**
   * Verify phone number for Auth0 user and complete signup
   */
  async verifyAuth0Phone(otpId: string, code: string): Promise<AuthToken> {
    // Verify OTP and get authentication result
    const authResult = await this.phoneVerificationService.verifyOTPWithAuth(otpId, code);
    
    // Update user phone verification status
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE users SET is_phone_verified = true WHERE id = $1',
        [authResult.user.id]
      );

      // Return updated auth result
      return {
        ...authResult,
        user: {
          ...authResult.user,
          isPhoneVerified: true
        }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Get Auth0 profile for a user
   */
  async getAuth0Profile(userId: string): Promise<Auth0Profile | null> {
    const result = await pool.query(
      'SELECT * FROM auth0_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      auth0Id: row.auth0_id,
      profileData: row.profile_data,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Update Auth0 profile data
   */
  async updateAuth0Profile(userId: string, profileData: Auth0UserProfile): Promise<void> {
    const client = await pool.connect();
    
    try {
      await this.upsertAuth0Profile(client, userId, profileData);
    } finally {
      client.release();
    }
  }

  /**
   * Get Auth0 authorization URL for signup/login
   */
  getAuthorizationUrl(state?: string): string {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const callbackUrl = process.env.AUTH0_CALLBACK_URL;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: callbackUrl!,
      scope: 'openid profile email',
      ...(state && { state })
    });

    return `https://${domain}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens and user info
   */
  async exchangeCodeForTokens(code: string): Promise<Auth0UserProfile> {
    try {
      const domain = process.env.AUTH0_DOMAIN;
      const clientId = process.env.AUTH0_CLIENT_ID;
      const clientSecret = process.env.AUTH0_CLIENT_SECRET;
      const callbackUrl = process.env.AUTH0_CALLBACK_URL;
      
      // Exchange code for tokens using direct API call
      const tokenResponse = await axios.post(`https://${domain}/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: callbackUrl
      });

      const { access_token } = tokenResponse.data;

      // Get user info using access token
      const userInfoResponse = await axios.get(`https://${domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      
      return userInfoResponse.data as Auth0UserProfile;

    } catch (error: any) {
      throw new Error(`Auth0 token exchange failed: ${error.message}`);
    }
  }

  /**
   * Private helper to upsert Auth0 profile
   */
  private async upsertAuth0Profile(client: any, userId: string, profileData: Auth0UserProfile): Promise<void> {
    await client.query(`
      INSERT INTO auth0_profiles (id, user_id, auth0_id, profile_data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (auth0_id) 
      DO UPDATE SET 
        profile_data = $4,
        updated_at = $6
    `, [
      uuidv4(),
      userId,
      profileData.sub,
      JSON.stringify(profileData),
      new Date(),
      new Date()
    ]);
  }

  /**
   * Private helper to map database row to User object
   */
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
      auth0Id: row.auth0_id,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : new Date()
    };
  }
}