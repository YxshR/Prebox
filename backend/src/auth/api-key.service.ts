import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { ApiKey, SubscriptionTier } from '../shared/types';

export interface ApiKeyCreateRequest {
  name: string;
  scopes: string[];
  expiresAt?: Date;
}

export interface ApiKeyListResponse {
  id: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  // Note: key is never returned in list responses for security
}

export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  dataTransferred: number;
  uniqueEndpoints: number;
  lastUsed?: Date;
}

export class ApiKeyService {
  
  /**
   * Generate a new API key for a user
   */
  async generateApiKey(userId: string, tenantId: string, request: ApiKeyCreateRequest): Promise<ApiKey> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check user's subscription tier to determine API key limits
      const tierResult = await client.query(`
        SELECT u.subscription_tier, COUNT(ak.id) as existing_keys
        FROM users u
        LEFT JOIN api_keys ak ON u.id = ak.user_id AND ak.is_active = true
        WHERE u.id = $1
        GROUP BY u.subscription_tier
      `, [userId]);

      if (tierResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const { subscription_tier, existing_keys } = tierResult.rows[0];
      const existingKeyCount = parseInt(existing_keys) || 0;

      // Enforce API key limits based on subscription tier
      const keyLimits = this.getApiKeyLimits(subscription_tier);
      if (existingKeyCount >= keyLimits.maxKeys) {
        throw new Error(`Maximum API keys limit reached for ${subscription_tier} tier (${keyLimits.maxKeys})`);
      }

      // Validate scopes based on subscription tier
      const allowedScopes = this.getAllowedScopes(subscription_tier);
      const invalidScopes = request.scopes.filter(scope => !allowedScopes.includes(scope));
      if (invalidScopes.length > 0) {
        throw new Error(`Invalid scopes for ${subscription_tier} tier: ${invalidScopes.join(', ')}`);
      }

      // Generate API key
      const apiKeyId = uuidv4();
      const key = `bep_${Buffer.from(uuidv4()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
      const keyHash = await bcrypt.hash(key, 10);

      // Insert API key
      const result = await client.query(`
        INSERT INTO api_keys (id, user_id, tenant_id, key_hash, name, scopes, is_active, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        apiKeyId,
        userId,
        tenantId,
        keyHash,
        request.name,
        JSON.stringify(request.scopes),
        true,
        request.expiresAt || null,
        new Date()
      ]);

      // Initialize rate limits for the new API key
      await this.initializeRateLimits(client, tenantId, apiKeyId, subscription_tier);

      await client.query('COMMIT');

      return {
        id: apiKeyId,
        userId,
        key, // Return the plain key only once
        name: request.name,
        scopes: request.scopes,
        isActive: true,
        expiresAt: request.expiresAt,
        createdAt: new Date(),
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List all API keys for a user (without the actual key values)
   */
  async listApiKeys(userId: string): Promise<ApiKeyListResponse[]> {
    const result = await pool.query(`
      SELECT id, name, scopes, is_active, last_used_at, expires_at, created_at
      FROM api_keys
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      scopes: JSON.parse(row.scopes),
      isActive: row.is_active,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(userId: string, apiKeyId: string): Promise<void> {
    const result = await pool.query(`
      UPDATE api_keys 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `, [apiKeyId, userId]);

    if (result.rowCount === 0) {
      throw new Error('API key not found or access denied');
    }
  }

  /**
   * Update API key details (name, scopes, expiration)
   */
  async updateApiKey(userId: string, apiKeyId: string, updates: Partial<ApiKeyCreateRequest>): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Get current API key and user's subscription tier
      const keyResult = await client.query(`
        SELECT ak.*, u.subscription_tier
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.id = $1 AND ak.user_id = $2
      `, [apiKeyId, userId]);

      if (keyResult.rows.length === 0) {
        throw new Error('API key not found or access denied');
      }

      const { subscription_tier } = keyResult.rows[0];

      // Validate scopes if being updated
      if (updates.scopes) {
        const allowedScopes = this.getAllowedScopes(subscription_tier);
        const invalidScopes = updates.scopes.filter(scope => !allowedScopes.includes(scope));
        if (invalidScopes.length > 0) {
          throw new Error(`Invalid scopes for ${subscription_tier} tier: ${invalidScopes.join(', ')}`);
        }
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.name) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(updates.name);
      }

      if (updates.scopes) {
        updateFields.push(`scopes = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.scopes));
      }

      if (updates.expiresAt !== undefined) {
        updateFields.push(`expires_at = $${paramIndex++}`);
        updateValues.push(updates.expiresAt);
      }

      if (updateFields.length === 0) {
        return; // Nothing to update
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(apiKeyId, userId);

      await client.query(`
        UPDATE api_keys 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      `, updateValues);

    } finally {
      client.release();
    }
  }

  /**
   * Get API usage statistics for a specific API key
   */
  async getApiKeyUsage(userId: string, apiKeyId: string, days: number = 30): Promise<ApiUsageStats> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
        AVG(response_time_ms) as avg_response_time,
        SUM(COALESCE(request_size_bytes, 0) + COALESCE(response_size_bytes, 0)) as data_transferred,
        COUNT(DISTINCT endpoint) as unique_endpoints,
        MAX(created_at) as last_used
      FROM api_usage au
      JOIN api_keys ak ON au.api_key_id = ak.id
      WHERE ak.id = $1 AND ak.user_id = $2 
        AND au.created_at >= NOW() - INTERVAL '${days} days'
    `, [apiKeyId, userId]);

    const row = result.rows[0];
    return {
      totalRequests: parseInt(row.total_requests) || 0,
      successfulRequests: parseInt(row.successful_requests) || 0,
      failedRequests: parseInt(row.failed_requests) || 0,
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      dataTransferred: parseInt(row.data_transferred) || 0,
      uniqueEndpoints: parseInt(row.unique_endpoints) || 0,
      lastUsed: row.last_used ? new Date(row.last_used) : undefined
    };
  }

  /**
   * Validate API key and return associated user
   */
  async validateApiKey(apiKey: string): Promise<{ user: any; apiKeyId: string; scopes: string[] }> {
    // Get all active API keys and check hash
    const result = await pool.query(`
      SELECT ak.*, u.* FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.is_active = true 
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    `);

    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);
      if (isValid) {
        // Update last used timestamp
        await pool.query(
          'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
          [row.id]
        );

        return {
          user: {
            id: row.user_id,
            email: row.email,
            tenantId: row.tenant_id,
            role: row.role,
            subscriptionTier: row.subscription_tier,
            isEmailVerified: row.is_email_verified,
            isPhoneVerified: row.is_phone_verified
          },
          apiKeyId: row.id,
          scopes: JSON.parse(row.scopes)
        };
      }
    }

    throw new Error('Invalid API key');
  }

  /**
   * Initialize rate limits for a new API key based on subscription tier
   */
  private async initializeRateLimits(client: any, tenantId: string, apiKeyId: string, subscriptionTier: SubscriptionTier): Promise<void> {
    const limits = this.getRateLimits(subscriptionTier);
    
    for (const [limitType, limitValue] of Object.entries(limits)) {
      const resetAt = this.calculateResetTime(limitType);
      
      await client.query(`
        INSERT INTO rate_limits (tenant_id, api_key_id, limit_type, limit_value, current_usage, reset_at)
        VALUES ($1, $2, $3, $4, 0, $5)
      `, [tenantId, apiKeyId, limitType, limitValue, resetAt]);
    }
  }

  /**
   * Get API key limits based on subscription tier
   */
  private getApiKeyLimits(tier: SubscriptionTier): { maxKeys: number } {
    switch (tier) {
      case SubscriptionTier.FREE:
        return { maxKeys: 1 };
      case SubscriptionTier.PAID_STANDARD:
        return { maxKeys: 3 };
      case SubscriptionTier.PREMIUM:
        return { maxKeys: 10 };
      case SubscriptionTier.ENTERPRISE:
        return { maxKeys: 50 };
      default:
        return { maxKeys: 1 };
    }
  }

  /**
   * Get allowed scopes based on subscription tier
   */
  private getAllowedScopes(tier: SubscriptionTier): string[] {
    const baseScopes = ['email:send', 'email:read'];
    
    switch (tier) {
      case SubscriptionTier.FREE:
        return baseScopes;
      case SubscriptionTier.PAID_STANDARD:
        return [...baseScopes, 'templates:read', 'templates:write', 'contacts:read'];
      case SubscriptionTier.PREMIUM:
        return [...baseScopes, 'templates:read', 'templates:write', 'contacts:read', 'contacts:write', 'analytics:read', 'domains:read'];
      case SubscriptionTier.ENTERPRISE:
        return [...baseScopes, 'templates:read', 'templates:write', 'contacts:read', 'contacts:write', 'analytics:read', 'domains:read', 'domains:write', 'admin:read'];
      default:
        return baseScopes;
    }
  }

  /**
   * Get rate limits based on subscription tier
   */
  private getRateLimits(tier: SubscriptionTier): Record<string, number> {
    switch (tier) {
      case SubscriptionTier.FREE:
        return {
          hourly: 50,
          daily: 100,
          monthly: 2000
        };
      case SubscriptionTier.PAID_STANDARD:
        return {
          hourly: 500,
          daily: 1000,
          monthly: 30000
        };
      case SubscriptionTier.PREMIUM:
        return {
          hourly: 2000,
          daily: 5000,
          monthly: 100000
        };
      case SubscriptionTier.ENTERPRISE:
        return {
          hourly: 10000,
          daily: 25000,
          monthly: 1000000
        };
      default:
        return {
          hourly: 50,
          daily: 100,
          monthly: 2000
        };
    }
  }

  /**
   * Calculate reset time for rate limit based on limit type
   */
  private calculateResetTime(limitType: string): Date {
    const now = new Date();
    
    switch (limitType) {
      case 'hourly':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      default:
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour default
    }
  }
}