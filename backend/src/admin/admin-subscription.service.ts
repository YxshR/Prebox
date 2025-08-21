import { DatabaseService } from '../database/database.service';
import { Subscription, BillingSubscriptionStatus, SubscriptionTier, ApiResponse } from '../shared/types';

export interface SubscriptionFilters {
  status?: BillingSubscriptionStatus;
  tier?: SubscriptionTier;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
  subscriptionsByTier: Record<SubscriptionTier, number>;
  monthlyRevenue: number;
  annualRevenue: number;
  averageRevenuePerUser: number;
}

export interface AdminSubscriptionUpdate {
  status?: BillingSubscriptionStatus;
  planId?: string;
  currentPeriodEnd?: Date;
  rechargeBalance?: number;
}

export class AdminSubscriptionService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async getSubscriptions(filters: SubscriptionFilters = {}): Promise<ApiResponse<any[]>> {
    const {
      status,
      tier,
      search,
      page = 1,
      limit = 20
    } = filters;

    let query = `
      SELECT s.*, u.email, u.first_name, u.last_name, t.name as tenant_name,
             sp.name as plan_name, sp.price as plan_price
      FROM subscriptions s
      JOIN tenants t ON s.tenant_id = t.id
      JOIN users u ON t.id = u.tenant_id
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (tier) {
      query += ` AND u.subscription_tier = $${paramIndex}`;
      params.push(tier);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR t.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT s.*, u.email, u.first_name, u.last_name, t.name as tenant_name, sp.name as plan_name, sp.price as plan_price',
      'SELECT COUNT(*)'
    );
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      success: true,
      data: result.rows,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  async getSubscriptionById(subscriptionId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT s.*, u.email, u.first_name, u.last_name, t.name as tenant_name,
              sp.name as plan_name, sp.price as plan_price, sp.features as plan_features
       FROM subscriptions s
       JOIN tenants t ON s.tenant_id = t.id
       JOIN users u ON t.id = u.tenant_id
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.id = $1`,
      [subscriptionId]
    );

    if (!result.rows.length) {
      throw new Error('Subscription not found');
    }

    return result.rows[0];
  }

  async updateSubscription(subscriptionId: string, updates: AdminSubscriptionUpdate): Promise<any> {
    const allowedFields = ['status', 'planId', 'currentPeriodEnd', 'rechargeBalance'];
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = this.mapFieldToDb(key);
      if (allowedFields.includes(key) && dbField && value !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(subscriptionId);
    const query = `
      UPDATE subscriptions 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (!result.rows.length) {
      throw new Error('Subscription not found');
    }

    // If plan changed, update user's subscription tier
    if (updates.planId) {
      const planResult = await this.db.query(
        'SELECT tier FROM subscription_plans WHERE id = $1',
        [updates.planId]
      );
      
      if (planResult.rows.length) {
        await this.db.query(
          `UPDATE users SET subscription_tier = $1 
           WHERE tenant_id = (SELECT tenant_id FROM subscriptions WHERE id = $2)`,
          [planResult.rows[0].tier, subscriptionId]
        );
      }
    }

    return result.rows[0];
  }

  async cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
    await this.db.query('BEGIN');

    try {
      // Update subscription status
      await this.db.query(
        `UPDATE subscriptions 
         SET status = 'cancelled', 
             cancelled_at = NOW(),
             cancellation_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [subscriptionId, reason || 'Admin cancellation']
      );

      // Update user tier to free
      await this.db.query(
        `UPDATE users SET subscription_tier = 'free' 
         WHERE tenant_id = (SELECT tenant_id FROM subscriptions WHERE id = $1)`,
        [subscriptionId]
      );

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async getSubscriptionStats(): Promise<SubscriptionStats> {
    const queries = [
      // Total subscriptions
      'SELECT COUNT(*) as total FROM subscriptions',
      
      // Active subscriptions
      'SELECT COUNT(*) as active FROM subscriptions WHERE status = \'active\'',
      
      // Cancelled subscriptions
      'SELECT COUNT(*) as cancelled FROM subscriptions WHERE status = \'cancelled\'',
      
      // Trial subscriptions
      'SELECT COUNT(*) as trial FROM subscriptions WHERE status = \'trialing\'',
      
      // Past due subscriptions
      'SELECT COUNT(*) as past_due FROM subscriptions WHERE status = \'past_due\'',
      
      // Subscriptions by tier
      `SELECT u.subscription_tier, COUNT(*) as count 
       FROM subscriptions s 
       JOIN users u ON s.tenant_id = u.tenant_id 
       WHERE s.status = 'active'
       GROUP BY u.subscription_tier`,
      
      // Monthly revenue (current month)
      `SELECT COALESCE(SUM(sp.price), 0) as revenue
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.status = 'active' 
       AND s.current_period_start >= DATE_TRUNC('month', NOW())`,
      
      // Annual revenue (last 12 months)
      `SELECT COALESCE(SUM(sp.price), 0) as revenue
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.status = 'active' 
       AND s.current_period_start >= NOW() - INTERVAL '12 months'`
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const subscriptionsByTier = results[5].rows.reduce((acc, row) => {
      acc[row.subscription_tier as SubscriptionTier] = parseInt(row.count);
      return acc;
    }, {} as Record<SubscriptionTier, number>);

    const totalSubscriptions = parseInt(results[0].rows[0].total);
    const monthlyRevenue = parseFloat(results[6].rows[0].revenue || '0');
    const annualRevenue = parseFloat(results[7].rows[0].revenue || '0');

    return {
      totalSubscriptions,
      activeSubscriptions: parseInt(results[1].rows[0].active),
      cancelledSubscriptions: parseInt(results[2].rows[0].cancelled),
      trialSubscriptions: parseInt(results[3].rows[0].trial),
      pastDueSubscriptions: parseInt(results[4].rows[0].past_due),
      subscriptionsByTier,
      monthlyRevenue,
      annualRevenue,
      averageRevenuePerUser: totalSubscriptions > 0 ? annualRevenue / totalSubscriptions : 0
    };
  }

  async getRevenueHistory(months: number = 12): Promise<any[]> {
    const query = `
      SELECT 
        DATE_TRUNC('month', s.current_period_start) as month,
        COUNT(*) as subscriptions,
        SUM(sp.price) as revenue
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.current_period_start >= NOW() - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', s.current_period_start)
      ORDER BY month DESC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private mapFieldToDb(field: string): string | null {
    const fieldMap: Record<string, string> = {
      planId: 'plan_id',
      currentPeriodEnd: 'current_period_end',
      rechargeBalance: 'recharge_balance'
    };

    return fieldMap[field] || (field === 'status' ? field : null);
  }
}