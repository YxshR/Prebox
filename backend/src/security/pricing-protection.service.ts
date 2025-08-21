import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database';

export interface SecurePricingData {
  planId: string;
  planName: string;
  priceAmount: number;
  currency: string;
  billingCycle: string;
  features: string[];
  limits: Record<string, any>;
  isPopular: boolean;
  jwtSignature: string;
}

export interface PricingValidationResult {
  isValid: boolean;
  error?: string;
  pricingData?: SecurePricingData;
}

export interface PricingTamperingEvent {
  userId?: string;
  clientPlanId: string;
  clientPrice: number;
  serverPrice: number;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * PricingProtectionService - Handles JWT-signed pricing data and server-side validation
 * Implements Requirements 7.1, 7.2, 7.3, 7.4, 8.1, 8.2
 */
export class PricingProtectionService {
  private readonly jwtSecret: string;
  private readonly algorithm = 'HS256';
  private readonly tokenExpiry = '24h';

  constructor() {
    this.jwtSecret = process.env.PRICING_JWT_SECRET || process.env.JWT_SECRET || 'fallback_pricing_secret';
    
    if (!this.jwtSecret || this.jwtSecret === 'fallback_pricing_secret') {
      console.warn('⚠️ Using fallback JWT secret for pricing protection. Set PRICING_JWT_SECRET in production.');
    }
  }

  /**
   * Generate JWT signature for pricing data
   * Requirement 7.1: Store pricing with JWT-signed integrity protection
   */
  signPricingData(pricingData: Omit<SecurePricingData, 'jwtSignature'>): string {
    try {
      const payload = {
        planId: pricingData.planId,
        priceAmount: pricingData.priceAmount,
        currency: pricingData.currency,
        billingCycle: pricingData.billingCycle,
        timestamp: Date.now()
      };

      return jwt.sign(payload, this.jwtSecret, {
        algorithm: this.algorithm,
        expiresIn: this.tokenExpiry,
        issuer: 'perbox-pricing-service',
        subject: pricingData.planId
      });
    } catch (error) {
      console.error('Failed to sign pricing data:', error);
      throw new Error('Pricing signature generation failed');
    }
  }

  /**
   * Verify JWT signature for pricing data
   * Requirement 7.2: Verify JWT signatures before displaying prices
   */
  verifyPricingSignature(
    planId: string,
    priceAmount: number,
    currency: string,
    billingCycle: string,
    signature: string
  ): boolean {
    try {
      const decoded = jwt.verify(signature, this.jwtSecret, {
        algorithms: [this.algorithm],
        issuer: 'perbox-pricing-service',
        subject: planId
      }) as any;

      // Verify the pricing data matches the signature
      return (
        decoded.planId === planId &&
        decoded.priceAmount === priceAmount &&
        decoded.currency === currency &&
        decoded.billingCycle === billingCycle
      );
    } catch (error) {
      console.error('Pricing signature verification failed:', error);
      return false;
    }
  }

  /**
   * Get secure pricing data from database with signature validation
   * Requirement 7.2: Verify JWT signatures before displaying prices
   */
  async getSecurePricing(planId?: string): Promise<SecurePricingData[]> {
    try {
      const query = planId 
        ? 'SELECT * FROM get_secure_pricing($1)'
        : 'SELECT * FROM get_secure_pricing()';
      
      const params = planId ? [planId] : [];
      const result = await pool.query(query, params);

      return result.rows.map(row => ({
        planId: row.plan_id,
        planName: row.plan_name,
        priceAmount: parseFloat(row.price_amount),
        currency: row.currency,
        billingCycle: row.billing_cycle,
        features: Array.isArray(row.features) ? row.features : [],
        limits: row.limits || {},
        isPopular: row.is_popular || false,
        jwtSignature: row.jwt_signature
      }));
    } catch (error) {
      console.error('Failed to retrieve secure pricing:', error);
      throw new Error('Pricing data retrieval failed');
    }
  }

  /**
   * Validate pricing data against server-side values
   * Requirement 7.3: Validate all pricing server-side using database values
   */
  async validatePricing(
    planId: string,
    clientPrice: number,
    clientCurrency: string = 'INR'
  ): Promise<PricingValidationResult> {
    try {
      // Get server-side pricing data
      const serverPricing = await this.getSecurePricing(planId);
      
      if (serverPricing.length === 0) {
        return {
          isValid: false,
          error: 'Plan not found'
        };
      }

      const serverData = serverPricing[0];

      // Verify signature integrity
      const signatureValid = this.verifyPricingSignature(
        serverData.planId,
        serverData.priceAmount,
        serverData.currency,
        serverData.billingCycle,
        serverData.jwtSignature
      );

      if (!signatureValid) {
        return {
          isValid: false,
          error: 'Pricing signature validation failed'
        };
      }

      // Compare client vs server pricing
      const priceMatches = Math.abs(clientPrice - serverData.priceAmount) < 0.01; // Allow for floating point precision
      const currencyMatches = clientCurrency.toUpperCase() === serverData.currency.toUpperCase();

      if (!priceMatches || !currencyMatches) {
        // Log potential tampering attempt
        await this.logTamperingAttempt({
          clientPlanId: planId,
          clientPrice,
          serverPrice: serverData.priceAmount,
          timestamp: new Date()
        });

        return {
          isValid: false,
          error: 'Pricing data mismatch detected'
        };
      }

      return {
        isValid: true,
        pricingData: serverData
      };
    } catch (error) {
      console.error('Pricing validation failed:', error);
      return {
        isValid: false,
        error: 'Pricing validation error'
      };
    }
  }

  /**
   * Validate subscription/purchase request with server-side pricing
   * Requirement 7.4: Ignore client-side pricing data and use only server-verified amounts
   */
  async validatePurchaseRequest(
    planId: string,
    clientAmount: number,
    userId?: string
  ): Promise<{ isValid: boolean; serverAmount?: number; error?: string }> {
    try {
      const validation = await this.validatePricing(planId, clientAmount);
      
      if (!validation.isValid) {
        // Enhanced logging for purchase attempts
        await this.logTamperingAttempt({
          userId,
          clientPlanId: planId,
          clientPrice: clientAmount,
          serverPrice: validation.pricingData?.priceAmount || 0,
          timestamp: new Date()
        });

        return {
          isValid: false,
          error: validation.error || 'Purchase validation failed'
        };
      }

      return {
        isValid: true,
        serverAmount: validation.pricingData!.priceAmount
      };
    } catch (error) {
      console.error('Purchase validation failed:', error);
      return {
        isValid: false,
        error: 'Purchase validation error'
      };
    }
  }

  /**
   * Create or update pricing data with automatic signature generation
   * Requirement 7.1: Store pricing with JWT-signed integrity protection
   */
  async createOrUpdatePricing(pricingData: Omit<SecurePricingData, 'jwtSignature'>): Promise<SecurePricingData> {
    try {
      // Generate JWT signature
      const signature = this.signPricingData(pricingData);

      const query = `
        INSERT INTO secure_pricing (
          plan_id, plan_name, price_amount, currency, billing_cycle,
          features, limits, is_popular, jwt_signature
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (plan_id) 
        DO UPDATE SET
          plan_name = EXCLUDED.plan_name,
          price_amount = EXCLUDED.price_amount,
          currency = EXCLUDED.currency,
          billing_cycle = EXCLUDED.billing_cycle,
          features = EXCLUDED.features,
          limits = EXCLUDED.limits,
          is_popular = EXCLUDED.is_popular,
          jwt_signature = EXCLUDED.jwt_signature,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const values = [
        pricingData.planId,
        pricingData.planName,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        JSON.stringify(pricingData.features),
        JSON.stringify(pricingData.limits),
        pricingData.isPopular,
        signature
      ];

      const result = await pool.query(query, values);
      const row = result.rows[0];

      return {
        planId: row.plan_id,
        planName: row.plan_name,
        priceAmount: parseFloat(row.price_amount),
        currency: row.currency,
        billingCycle: row.billing_cycle,
        features: Array.isArray(row.features) ? row.features : JSON.parse(row.features || '[]'),
        limits: typeof row.limits === 'object' ? row.limits : JSON.parse(row.limits || '{}'),
        isPopular: row.is_popular,
        jwtSignature: row.jwt_signature
      };
    } catch (error) {
      console.error('Failed to create/update pricing:', error);
      throw new Error('Pricing creation/update failed');
    }
  }

  /**
   * Generate secure pricing hash for additional validation
   * Requirement 8.1: Prevent access to sensitive pricing modification functions
   */
  generatePricingHash(planId: string, priceAmount: number, timestamp: number): string {
    const data = `${planId}:${priceAmount}:${timestamp}`;
    return crypto.createHmac('sha256', this.jwtSecret).update(data).digest('hex');
  }

  /**
   * Verify pricing hash for additional security
   * Requirement 8.2: Validate all critical operations server-side
   */
  verifyPricingHash(planId: string, priceAmount: number, timestamp: number, hash: string): boolean {
    const expectedHash = this.generatePricingHash(planId, priceAmount, timestamp);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
  }

  /**
   * Log potential pricing tampering attempts
   * Requirement 8.5: Log security events for unauthorized changes
   */
  private async logTamperingAttempt(event: PricingTamperingEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO security_events (
          event_type, user_id, event_data, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const eventData = {
        type: 'pricing_tampering_attempt',
        clientPlanId: event.clientPlanId,
        clientPrice: event.clientPrice,
        serverPrice: event.serverPrice,
        priceDifference: Math.abs(event.clientPrice - event.serverPrice)
      };

      await pool.query(query, [
        'pricing_tampering_attempt',
        event.userId || null,
        JSON.stringify(eventData),
        event.ipAddress || null,
        event.userAgent || null,
        event.timestamp
      ]);

      console.warn('🚨 Pricing tampering attempt detected:', eventData);
    } catch (error) {
      console.error('Failed to log tampering attempt:', error);
      // Don't throw error to avoid disrupting the main flow
    }
  }

  /**
   * Get pricing tampering statistics for monitoring
   * Requirement 8.5: Monitor security events
   */
  async getTamperingStatistics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalAttempts: number;
    uniqueUsers: number;
    averagePriceDifference: number;
    topTargetedPlans: Array<{ planId: string; attempts: number }>;
  }> {
    try {
      const interval = timeframe === 'hour' ? '1 hour' : timeframe === 'day' ? '1 day' : '1 week';
      
      const query = `
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(DISTINCT user_id) as unique_users,
          AVG((event_data->>'priceDifference')::numeric) as avg_price_difference,
          json_agg(
            json_build_object(
              'planId', event_data->>'clientPlanId',
              'attempts', COUNT(*)
            )
          ) as plan_attempts
        FROM security_events 
        WHERE event_type = 'pricing_tampering_attempt' 
        AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY event_data->>'clientPlanId'
      `;

      const result = await pool.query(query);
      
      if (result.rows.length === 0) {
        return {
          totalAttempts: 0,
          uniqueUsers: 0,
          averagePriceDifference: 0,
          topTargetedPlans: []
        };
      }

      const row = result.rows[0];
      return {
        totalAttempts: parseInt(row.total_attempts) || 0,
        uniqueUsers: parseInt(row.unique_users) || 0,
        averagePriceDifference: parseFloat(row.avg_price_difference) || 0,
        topTargetedPlans: row.plan_attempts || []
      };
    } catch (error) {
      console.error('Failed to get tampering statistics:', error);
      return {
        totalAttempts: 0,
        uniqueUsers: 0,
        averagePriceDifference: 0,
        topTargetedPlans: []
      };
    }
  }
}