import pool from './database';
import { PoolClient } from 'pg';

/**
 * Security-focused database utilities for enhanced authentication and pricing protection
 */

export interface UserSecurityData {
  id: string;
  jwt_secret: string;
  jwt_refresh_secret: string;
  phone?: string;
  is_phone_verified: boolean;
}

export interface OTPVerification {
  id: string;
  phone_number: string;
  otp_code: string;
  expires_at: Date;
  attempts: number;
  max_attempts: number;
  is_used: boolean;
  user_id?: string;
}

export interface SecurePricing {
  plan_id: string;
  plan_name: string;
  price_amount: number;
  currency: string;
  billing_cycle: string;
  features: string[];
  limits: Record<string, any>;
  is_popular: boolean;
  jwt_signature: string;
}

export interface MediaAsset {
  id: string;
  asset_type: 'image' | 'video' | 'animation' | 'icon';
  file_path: string;
  file_name: string;
  alt_text?: string;
  caption?: string;
  section: 'hero' | 'features' | 'pricing' | 'testimonials' | 'footer';
  display_order: number;
  metadata: Record<string, any>;
}

/**
 * Security Database Service
 */
export class SecurityDatabaseService {
  
  /**
   * Get user security data including JWT secrets
   */
  static async getUserSecurityData(userId: string): Promise<UserSecurityData | null> {
    const query = `
      SELECT id, jwt_secret, jwt_refresh_secret, phone, is_phone_verified
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user security data by phone number
   */
  static async getUserSecurityDataByPhone(phoneNumber: string): Promise<UserSecurityData | null> {
    const query = `
      SELECT id, jwt_secret, jwt_refresh_secret, phone, is_phone_verified
      FROM users 
      WHERE phone = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [phoneNumber]);
    return result.rows[0] || null;
  }

  /**
   * Update user JWT secrets (for rotation)
   */
  static async rotateUserJWTSecrets(userId: string): Promise<UserSecurityData | null> {
    const query = `
      UPDATE users 
      SET 
        jwt_secret = encode(digest(random()::text || clock_timestamp()::text || id::text, 'sha256'), 'hex'),
        jwt_refresh_secret = encode(digest(random()::text || clock_timestamp()::text || id::text || 'refresh', 'sha256'), 'hex'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING id, jwt_secret, jwt_refresh_secret, phone, is_phone_verified
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Create OTP verification record
   */
  static async createOTPVerification(
    phoneNumber: string, 
    otpCode: string, 
    expiresInMinutes: number = 10,
    userId?: string
  ): Promise<string> {
    const query = `
      INSERT INTO otp_verifications (phone_number, otp_code, expires_at, user_id)
      VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '${expiresInMinutes} minutes', $3)
      RETURNING id
    `;
    
    const result = await pool.query(query, [phoneNumber, otpCode, userId || null]);
    return result.rows[0].id;
  }

  /**
   * Validate OTP using database function
   */
  static async validateOTP(phoneNumber: string, otpCode: string): Promise<{
    isValid: boolean;
    userId?: string;
    errorMessage?: string;
  }> {
    const query = `SELECT * FROM validate_otp($1, $2)`;
    
    const result = await pool.query(query, [phoneNumber, otpCode]);
    const validation = result.rows[0];
    
    return {
      isValid: validation.is_valid,
      userId: validation.user_id,
      errorMessage: validation.error_message
    };
  }

  /**
   * Clean up expired OTPs
   */
  static async cleanupExpiredOTPs(): Promise<number> {
    const query = `SELECT cleanup_expired_otps()`;
    const result = await pool.query(query);
    return result.rows[0].cleanup_expired_otps;
  }

  /**
   * Get secure pricing data
   */
  static async getSecurePricing(planId?: string): Promise<SecurePricing[]> {
    const query = `SELECT * FROM get_secure_pricing($1)`;
    const result = await pool.query(query, [planId || null]);
    
    return result.rows.map(row => ({
      plan_id: row.plan_id,
      plan_name: row.plan_name,
      price_amount: parseFloat(row.price_amount),
      currency: row.currency,
      billing_cycle: row.billing_cycle,
      features: row.features,
      limits: row.limits,
      is_popular: row.is_popular,
      jwt_signature: row.jwt_signature
    }));
  }

  /**
   * Validate pricing signature
   */
  static async validatePricingSignature(
    planId: string,
    priceAmount: number,
    currency: string,
    billingCycle: string,
    signature: string
  ): Promise<boolean> {
    const query = `SELECT validate_pricing_signature($1, $2, $3, $4, $5)`;
    
    const result = await pool.query(query, [
      planId, 
      priceAmount, 
      currency, 
      billingCycle, 
      signature
    ]);
    
    return result.rows[0].validate_pricing_signature;
  }

  /**
   * Get media assets by section
   */
  static async getMediaAssetsBySection(section: string): Promise<MediaAsset[]> {
    const query = `SELECT * FROM get_media_assets_by_section($1)`;
    const result = await pool.query(query, [section]);
    
    return result.rows.map(row => ({
      id: row.id,
      asset_type: row.asset_type,
      file_path: row.file_path,
      file_name: row.file_name,
      alt_text: row.alt_text,
      caption: row.caption,
      section: section as any,
      display_order: row.display_order,
      metadata: row.metadata
    }));
  }

  /**
   * Get hero media assets
   */
  static async getHeroMediaAssets(): Promise<MediaAsset[]> {
    const query = `SELECT * FROM get_hero_media_assets()`;
    const result = await pool.query(query);
    
    return result.rows.map(row => ({
      id: row.id,
      asset_type: row.asset_type,
      file_path: row.file_path,
      file_name: row.file_name,
      alt_text: row.alt_text,
      caption: null,
      section: 'hero' as const,
      display_order: 0,
      metadata: row.metadata
    }));
  }

  /**
   * Add media asset
   */
  static async addMediaAsset(asset: Omit<MediaAsset, 'id'>): Promise<string> {
    const query = `
      INSERT INTO media_assets (
        asset_type, file_path, file_name, alt_text, caption, 
        section, display_order, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      asset.asset_type,
      asset.file_path,
      asset.file_name,
      asset.alt_text,
      asset.caption,
      asset.section,
      asset.display_order,
      JSON.stringify(asset.metadata)
    ]);
    
    return result.rows[0].id;
  }

  /**
   * Mark media asset as optimized
   */
  static async markMediaOptimized(
    assetId: string, 
    optimizationSettings: Record<string, any> = {}
  ): Promise<boolean> {
    const query = `SELECT mark_media_optimized($1, $2)`;
    
    const result = await pool.query(query, [
      assetId, 
      JSON.stringify(optimizationSettings)
    ]);
    
    return result.rows[0].mark_media_optimized;
  }

  /**
   * Execute query with connection pooling
   */
  static async executeQuery<T = any>(
    query: string, 
    params: any[] = []
  ): Promise<T[]> {
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Execute transaction
   */
  static async executeTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check for security database connections
   */
  static async healthCheck(): Promise<{
    database: boolean;
    securityTables: boolean;
    indexesOptimal: boolean;
  }> {
    try {
      // Test basic connection
      await pool.query('SELECT 1');
      
      // Test security tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'otp_verifications', 'secure_pricing', 'media_assets')
      `;
      const tablesResult = await pool.query(tablesQuery);
      const securityTables = tablesResult.rows.length === 4;
      
      // Test indexes exist
      const indexesQuery = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('users', 'otp_verifications', 'secure_pricing', 'media_assets')
        AND indexname LIKE 'idx_%'
      `;
      const indexesResult = await pool.query(indexesQuery);
      const indexesOptimal = indexesResult.rows.length >= 10; // Should have at least 10 security indexes
      
      return {
        database: true,
        securityTables,
        indexesOptimal
      };
    } catch (error) {
      console.error('Security database health check failed:', error);
      return {
        database: false,
        securityTables: false,
        indexesOptimal: false
      };
    }
  }
}

export default SecurityDatabaseService;