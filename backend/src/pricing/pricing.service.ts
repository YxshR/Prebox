import pool from '../config/database';
import redisClient from '../config/redis';
import { logger } from '../shared/logger';

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  limits: Record<string, number>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePricingPlanRequest {
  name: string;
  price: number;
  currency?: string;
  features: string[];
  limits: Record<string, number>;
  active?: boolean;
}

export interface UpdatePricingPlanRequest {
  name?: string;
  price?: number;
  currency?: string;
  features?: string[];
  limits?: Record<string, number>;
  active?: boolean;
}

/**
 * Core pricing service for managing pricing plans and data
 * Implements Requirements 4.1, 4.2, 4.3 from auth-troubleshooting spec
 */
export class PricingService {
  private readonly cacheKey = 'pricing:plans';
  private readonly cacheExpiry = 300; // 5 minutes

  /**
   * Get all pricing plans from database
   * Requirement 4.1: Display pricing information from database
   */
  async getAllPlans(): Promise<PricingPlan[]> {
    try {
      // Try cache first
      const cached = await this.getCachedPlans();
      if (cached) {
        return cached;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            id, name, price, currency, features, limits, active, 
            created_at as "createdAt", updated_at as "updatedAt"
          FROM pricing_plans 
          WHERE active = true 
          ORDER BY price ASC
        `);

        const plans: PricingPlan[] = result.rows.map(row => ({
          ...row,
          features: Array.isArray(row.features) ? row.features : [],
          limits: typeof row.limits === 'object' ? row.limits : {}
        }));

        // Cache the results
        await this.cachePlans(plans);

        return plans;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get pricing plans:', error);
      throw new Error('Failed to retrieve pricing plans from database');
    }
  }

  /**
   * Get specific pricing plan by ID
   * Requirement 4.1: Display pricing information from database
   */
  async getPlanById(id: string): Promise<PricingPlan | null> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            id, name, price, currency, features, limits, active, 
            created_at as "createdAt", updated_at as "updatedAt"
          FROM pricing_plans 
          WHERE id = $1 AND active = true
        `, [id]);

        if (result.rows.length === 0) {
          return null;
        }

        const row = result.rows[0];
        return {
          ...row,
          features: Array.isArray(row.features) ? row.features : [],
          limits: typeof row.limits === 'object' ? row.limits : {}
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to get pricing plan ${id}:`, error);
      throw new Error('Failed to retrieve pricing plan from database');
    }
  }

  /**
   * Create new pricing plan
   * Requirement 4.2: Manage pricing data in database
   */
  async createPlan(planData: CreatePricingPlanRequest): Promise<PricingPlan> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          INSERT INTO pricing_plans (name, price, currency, features, limits, active)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING 
            id, name, price, currency, features, limits, active, 
            created_at as "createdAt", updated_at as "updatedAt"
        `, [
          planData.name,
          planData.price,
          planData.currency || 'USD',
          JSON.stringify(planData.features),
          JSON.stringify(planData.limits),
          planData.active !== false
        ]);

        const row = result.rows[0];
        const plan: PricingPlan = {
          ...row,
          features: Array.isArray(row.features) ? row.features : [],
          limits: typeof row.limits === 'object' ? row.limits : {}
        };

        // Clear cache
        await this.clearCache();

        logger.info(`Created pricing plan: ${plan.id}`);
        return plan;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to create pricing plan:', error);
      throw new Error('Failed to create pricing plan in database');
    }
  }

  /**
   * Update existing pricing plan
   * Requirement 4.2: Manage pricing data in database
   */
  async updatePlan(id: string, planData: UpdatePricingPlanRequest): Promise<PricingPlan | null> {
    try {
      const client = await pool.connect();
      try {
        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (planData.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(planData.name);
        }
        if (planData.price !== undefined) {
          updates.push(`price = $${paramIndex++}`);
          values.push(planData.price);
        }
        if (planData.currency !== undefined) {
          updates.push(`currency = $${paramIndex++}`);
          values.push(planData.currency);
        }
        if (planData.features !== undefined) {
          updates.push(`features = $${paramIndex++}`);
          values.push(JSON.stringify(planData.features));
        }
        if (planData.limits !== undefined) {
          updates.push(`limits = $${paramIndex++}`);
          values.push(JSON.stringify(planData.limits));
        }
        if (planData.active !== undefined) {
          updates.push(`active = $${paramIndex++}`);
          values.push(planData.active);
        }

        if (updates.length === 0) {
          throw new Error('No fields to update');
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await client.query(`
          UPDATE pricing_plans 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING 
            id, name, price, currency, features, limits, active, 
            created_at as "createdAt", updated_at as "updatedAt"
        `, values);

        if (result.rows.length === 0) {
          return null;
        }

        const row = result.rows[0];
        const plan: PricingPlan = {
          ...row,
          features: Array.isArray(row.features) ? row.features : [],
          limits: typeof row.limits === 'object' ? row.limits : {}
        };

        // Clear cache
        await this.clearCache();

        logger.info(`Updated pricing plan: ${plan.id}`);
        return plan;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to update pricing plan ${id}:`, error);
      throw new Error('Failed to update pricing plan in database');
    }
  }

  /**
   * Delete pricing plan (soft delete by setting active = false)
   * Requirement 4.2: Manage pricing data in database
   */
  async deletePlan(id: string): Promise<boolean> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          UPDATE pricing_plans 
          SET active = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND active = true
        `, [id]);

        const deleted = (result.rowCount || 0) > 0;
        
        if (deleted) {
          // Clear cache
          await this.clearCache();
          logger.info(`Deleted pricing plan: ${id}`);
        }

        return deleted;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to delete pricing plan ${id}:`, error);
      throw new Error('Failed to delete pricing plan from database');
    }
  }

  /**
   * Get pricing plans with fallback data
   * Requirement 4.3: Provide fallback pricing when database fails
   */
  async getPlansWithFallback(): Promise<PricingPlan[]> {
    try {
      return await this.getAllPlans();
    } catch (error) {
      logger.warn('Database failed, returning fallback pricing:', error);
      return this.getFallbackPlans();
    }
  }

  /**
   * Validate pricing data integrity
   * Requirement 4.3: Ensure data integrity and accuracy
   */
  async validatePricingIntegrity(): Promise<{
    isValid: boolean;
    errors: string[];
    planCount: number;
  }> {
    const errors: string[] = [];
    let planCount = 0;

    try {
      const client = await pool.connect();
      try {
        // Check for plans with invalid data
        const result = await client.query(`
          SELECT id, name, price, currency, features, limits
          FROM pricing_plans 
          WHERE active = true
        `);

        planCount = result.rows.length;

        for (const row of result.rows) {
          // Validate price
          if (typeof row.price !== 'number' || row.price < 0) {
            errors.push(`Plan ${row.id}: Invalid price ${row.price}`);
          }

          // Validate currency
          if (!row.currency || row.currency.length !== 3) {
            errors.push(`Plan ${row.id}: Invalid currency ${row.currency}`);
          }

          // Validate features
          if (!Array.isArray(row.features)) {
            errors.push(`Plan ${row.id}: Features must be an array`);
          }

          // Validate limits
          if (typeof row.limits !== 'object' || row.limits === null) {
            errors.push(`Plan ${row.id}: Limits must be an object`);
          }

          // Validate name
          if (!row.name || row.name.trim().length === 0) {
            errors.push(`Plan ${row.id}: Name is required`);
          }
        }

        // Check for duplicate names
        const nameCheck = await client.query(`
          SELECT name, COUNT(*) as count
          FROM pricing_plans 
          WHERE active = true
          GROUP BY name
          HAVING COUNT(*) > 1
        `);

        for (const row of nameCheck.rows) {
          errors.push(`Duplicate plan name: ${row.name}`);
        }

      } finally {
        client.release();
      }
    } catch (error) {
      errors.push(`Database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      planCount
    };
  }

  /**
   * Seed default pricing plans
   * Requirement 4.2: Initialize pricing data in database
   */
  async seedDefaultPlans(): Promise<void> {
    try {
      const existingPlans = await this.getAllPlans();
      if (existingPlans.length > 0) {
        logger.info('Pricing plans already exist, skipping seed');
        return;
      }

      const defaultPlans: CreatePricingPlanRequest[] = [
        {
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: ['Basic email sending', 'Up to 100 contacts', 'Basic templates'],
          limits: {
            emailsPerMonth: 1000,
            contacts: 100,
            templates: 5
          }
        },
        {
          name: 'Starter',
          price: 29,
          currency: 'USD',
          features: ['All Free features', 'Up to 1,000 contacts', 'Advanced templates', 'Email analytics'],
          limits: {
            emailsPerMonth: 10000,
            contacts: 1000,
            templates: 25
          }
        },
        {
          name: 'Professional',
          price: 79,
          currency: 'USD',
          features: ['All Starter features', 'Up to 10,000 contacts', 'A/B testing', 'Advanced analytics', 'Priority support'],
          limits: {
            emailsPerMonth: 50000,
            contacts: 10000,
            templates: 100
          }
        },
        {
          name: 'Enterprise',
          price: 199,
          currency: 'USD',
          features: ['All Professional features', 'Unlimited contacts', 'Custom integrations', 'Dedicated support', 'White-label options'],
          limits: {
            emailsPerMonth: -1, // Unlimited
            contacts: -1, // Unlimited
            templates: -1 // Unlimited
          }
        }
      ];

      for (const planData of defaultPlans) {
        await this.createPlan(planData);
      }

      logger.info('Successfully seeded default pricing plans');
    } catch (error) {
      logger.error('Failed to seed default pricing plans:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getCachedPlans(): Promise<PricingPlan[] | null> {
    try {
      const cached = await redisClient.get(this.cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get cached pricing plans:', error);
      return null;
    }
  }

  private async cachePlans(plans: PricingPlan[]): Promise<void> {
    try {
      await redisClient.setex(this.cacheKey, this.cacheExpiry, JSON.stringify(plans));
    } catch (error) {
      logger.warn('Failed to cache pricing plans:', error);
      // Don't throw error to avoid disrupting main flow
    }
  }

  private async clearCache(): Promise<void> {
    try {
      await redisClient.del(this.cacheKey);
    } catch (error) {
      logger.warn('Failed to clear pricing cache:', error);
    }
  }

  private getFallbackPlans(): PricingPlan[] {
    return [
      {
        id: 'fallback-free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        features: ['Basic email sending', 'Up to 100 contacts'],
        limits: { emailsPerMonth: 1000, contacts: 100 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'fallback-starter',
        name: 'Starter',
        price: 29,
        currency: 'USD',
        features: ['All Free features', 'Up to 1,000 contacts', 'Advanced templates'],
        limits: { emailsPerMonth: 10000, contacts: 1000 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'fallback-pro',
        name: 'Professional',
        price: 79,
        currency: 'USD',
        features: ['All Starter features', 'Up to 10,000 contacts', 'A/B testing'],
        limits: { emailsPerMonth: 50000, contacts: 10000 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
}