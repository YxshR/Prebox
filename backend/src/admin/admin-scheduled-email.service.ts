import { DatabaseService } from '../database/database.service';
import { ScheduledEmailStatus, SubscriptionTier, ApiResponse } from '../shared/types';

export interface ScheduledEmailFilters {
  status?: ScheduledEmailStatus;
  subscriptionTier?: SubscriptionTier;
  userType?: 'subscription' | 'recharge';
  search?: string;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  page?: number;
  limit?: number;
}

export interface AdminScheduledEmail {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  campaignId: string;
  campaignName: string;
  subscriptionTier: SubscriptionTier;
  userType: 'subscription' | 'recharge';
  scheduledAt: string;
  status: ScheduledEmailStatus;
  estimatedCost: number;
  recipientCount: number;
  rechargeBalance: number;
  subscriptionStatus: string;
  subscriptionEnd: string;
  createdAt: string;
  sentAt?: string;
  cancelledAt?: string;
  failureReason?: string;
}

export interface ScheduledEmailStats {
  totalScheduled: number;
  pendingScheduled: number;
  sentScheduled: number;
  cancelledScheduled: number;
  failedScheduled: number;
  scheduledByTier: Record<SubscriptionTier, number>;
  scheduledByUserType: {
    subscription: number;
    recharge: number;
  };
  upcomingIn24Hours: number;
  estimatedRevenue: number;
}

export class AdminScheduledEmailService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async getScheduledEmails(filters: ScheduledEmailFilters = {}): Promise<ApiResponse<AdminScheduledEmail[]>> {
    const {
      status,
      subscriptionTier,
      userType,
      search,
      scheduledAfter,
      scheduledBefore,
      page = 1,
      limit = 20
    } = filters;

    let query = `
      SELECT 
        se.id,
        se.tenant_id,
        t.name as tenant_name,
        u.email as user_email,
        se.campaign_id,
        c.name as campaign_name,
        u.subscription_tier,
        se.user_type,
        se.scheduled_at,
        se.status,
        se.estimated_cost,
        se.recipient_count,
        s.recharge_balance,
        s.status as subscription_status,
        s.current_period_end as subscription_end,
        se.created_at,
        se.sent_at,
        se.cancelled_at,
        se.failure_reason
      FROM scheduled_emails se
      JOIN tenants t ON se.tenant_id = t.id
      JOIN users u ON t.id = u.tenant_id
      LEFT JOIN campaigns c ON se.campaign_id = c.id
      LEFT JOIN subscriptions s ON t.id = s.tenant_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND se.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (subscriptionTier) {
      query += ` AND u.subscription_tier = $${paramIndex}`;
      params.push(subscriptionTier);
      paramIndex++;
    }

    if (userType) {
      query += ` AND se.user_type = $${paramIndex}`;
      params.push(userType);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR t.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (scheduledAfter) {
      query += ` AND se.scheduled_at >= $${paramIndex}`;
      params.push(scheduledAfter);
      paramIndex++;
    }

    if (scheduledBefore) {
      query += ` AND se.scheduled_at <= $${paramIndex}`;
      params.push(scheduledBefore);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*) FROM'
    );
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY se.scheduled_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const scheduledEmails = result.rows.map(this.mapDbRowToScheduledEmail);

    return {
      success: true,
      data: scheduledEmails,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  async getScheduledEmailStats(): Promise<ScheduledEmailStats> {
    const queries = [
      // Total scheduled
      'SELECT COUNT(*) as total FROM scheduled_emails',
      
      // Pending scheduled
      'SELECT COUNT(*) as pending FROM scheduled_emails WHERE status = \'pending\'',
      
      // Sent scheduled
      'SELECT COUNT(*) as sent FROM scheduled_emails WHERE status = \'sent\'',
      
      // Cancelled scheduled
      'SELECT COUNT(*) as cancelled FROM scheduled_emails WHERE status = \'cancelled\'',
      
      // Failed scheduled
      'SELECT COUNT(*) as failed FROM scheduled_emails WHERE status = \'failed\'',
      
      // Scheduled by tier
      `SELECT u.subscription_tier, COUNT(*) as count
       FROM scheduled_emails se
       JOIN users u ON se.tenant_id = u.tenant_id
       GROUP BY u.subscription_tier`,
      
      // Scheduled by user type
      `SELECT user_type, COUNT(*) as count
       FROM scheduled_emails
       GROUP BY user_type`,
      
      // Upcoming in 24 hours
      `SELECT COUNT(*) as upcoming
       FROM scheduled_emails 
       WHERE status = 'pending' 
       AND scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'`,
      
      // Estimated revenue from pending scheduled emails
      `SELECT COALESCE(SUM(estimated_cost), 0) as revenue
       FROM scheduled_emails 
       WHERE status = 'pending'`
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const scheduledByTier = results[5].rows.reduce((acc, row) => {
      acc[row.subscription_tier as SubscriptionTier] = parseInt(row.count);
      return acc;
    }, {} as Record<SubscriptionTier, number>);

    const scheduledByUserType = results[6].rows.reduce((acc, row) => {
      acc[row.user_type as 'subscription' | 'recharge'] = parseInt(row.count);
      return acc;
    }, { subscription: 0, recharge: 0 });

    return {
      totalScheduled: parseInt(results[0].rows[0].total),
      pendingScheduled: parseInt(results[1].rows[0].pending),
      sentScheduled: parseInt(results[2].rows[0].sent),
      cancelledScheduled: parseInt(results[3].rows[0].cancelled),
      failedScheduled: parseInt(results[4].rows[0].failed),
      scheduledByTier,
      scheduledByUserType,
      upcomingIn24Hours: parseInt(results[7].rows[0].upcoming),
      estimatedRevenue: parseFloat(results[8].rows[0].revenue)
    };
  }

  async cancelScheduledEmail(scheduledEmailId: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE scheduled_emails 
       SET status = 'cancelled',
           cancelled_at = NOW(),
           failure_reason = $2,
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [scheduledEmailId, reason]
    );
  }

  async bulkCancelScheduledEmails(filters: {
    tenantId?: string;
    subscriptionTier?: SubscriptionTier;
    userType?: 'subscription' | 'recharge';
    scheduledBefore?: Date;
  }, reason: string): Promise<number> {
    let query = `
      UPDATE scheduled_emails 
      SET status = 'cancelled',
          cancelled_at = NOW(),
          failure_reason = $1,
          updated_at = NOW()
      WHERE status = 'pending'
    `;
    
    const params: any[] = [reason];
    let paramIndex = 2;

    if (filters.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(filters.tenantId);
      paramIndex++;
    }

    if (filters.subscriptionTier) {
      query += ` AND tenant_id IN (SELECT tenant_id FROM users WHERE subscription_tier = $${paramIndex})`;
      params.push(filters.subscriptionTier);
      paramIndex++;
    }

    if (filters.userType) {
      query += ` AND user_type = $${paramIndex}`;
      params.push(filters.userType);
      paramIndex++;
    }

    if (filters.scheduledBefore) {
      query += ` AND scheduled_at < $${paramIndex}`;
      params.push(filters.scheduledBefore);
      paramIndex++;
    }

    const result = await this.db.query(query, params);
    return result.rowCount || 0;
  }

  async rescheduleEmail(scheduledEmailId: string, newScheduledAt: Date): Promise<void> {
    // Validate the new schedule time based on user type and subscription
    const emailResult = await this.db.query(
      `SELECT se.*, u.subscription_tier, s.status as subscription_status, s.current_period_end
       FROM scheduled_emails se
       JOIN users u ON se.tenant_id = u.tenant_id
       LEFT JOIN subscriptions s ON se.tenant_id = s.tenant_id
       WHERE se.id = $1`,
      [scheduledEmailId]
    );

    if (!emailResult.rows.length) {
      throw new Error('Scheduled email not found');
    }

    const email = emailResult.rows[0];
    const now = new Date();
    const maxScheduleDate = new Date();

    // Apply scheduling limits
    if (email.user_type === 'subscription') {
      maxScheduleDate.setDate(now.getDate() + 14); // 14 days for subscription users
      
      if (newScheduledAt > maxScheduleDate) {
        throw new Error('Subscription users can only schedule emails up to 14 days in advance');
      }
      
      // Check if subscription will be active at scheduled time
      if (email.subscription_status !== 'active' || new Date(email.current_period_end) < newScheduledAt) {
        throw new Error('Subscription will not be active at the scheduled time');
      }
    }

    await this.db.query(
      `UPDATE scheduled_emails 
       SET scheduled_at = $2,
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [scheduledEmailId, newScheduledAt]
    );
  }

  async getScheduledEmailById(scheduledEmailId: string): Promise<AdminScheduledEmail> {
    const result = await this.db.query(
      `SELECT 
        se.id,
        se.tenant_id,
        t.name as tenant_name,
        u.email as user_email,
        se.campaign_id,
        c.name as campaign_name,
        u.subscription_tier,
        se.user_type,
        se.scheduled_at,
        se.status,
        se.estimated_cost,
        se.recipient_count,
        s.recharge_balance,
        s.status as subscription_status,
        s.current_period_end as subscription_end,
        se.created_at,
        se.sent_at,
        se.cancelled_at,
        se.failure_reason
      FROM scheduled_emails se
      JOIN tenants t ON se.tenant_id = t.id
      JOIN users u ON t.id = u.tenant_id
      LEFT JOIN campaigns c ON se.campaign_id = c.id
      LEFT JOIN subscriptions s ON t.id = s.tenant_id
      WHERE se.id = $1`,
      [scheduledEmailId]
    );

    if (!result.rows.length) {
      throw new Error('Scheduled email not found');
    }

    return this.mapDbRowToScheduledEmail(result.rows[0]);
  }

  private mapDbRowToScheduledEmail(row: any): AdminScheduledEmail {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      userEmail: row.user_email,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name || 'Unknown Campaign',
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      userType: row.user_type as 'subscription' | 'recharge',
      scheduledAt: row.scheduled_at,
      status: row.status as ScheduledEmailStatus,
      estimatedCost: parseFloat(row.estimated_cost || '0'),
      recipientCount: parseInt(row.recipient_count || '0'),
      rechargeBalance: parseFloat(row.recharge_balance || '0'),
      subscriptionStatus: row.subscription_status || 'unknown',
      subscriptionEnd: row.subscription_end,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      cancelledAt: row.cancelled_at,
      failureReason: row.failure_reason
    };
  }
}