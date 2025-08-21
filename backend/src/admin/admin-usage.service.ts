import { DatabaseService } from '../database/database.service';
import { SubscriptionTier, ApiResponse } from '../shared/types';

export interface UsageFilters {
  tenantId?: string;
  subscriptionTier?: SubscriptionTier;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TenantUsage {
  tenantId: string;
  tenantName: string;
  userEmail: string;
  subscriptionTier: SubscriptionTier;
  dailyEmailsSent: number;
  monthlyEmailsSent: number;
  uniqueRecipients: number;
  templatesCreated: number;
  customDomainsUsed: number;
  rechargeBalance: number;
  dailyLimit: number;
  monthlyEmailLimit: number;
  monthlyRecipientLimit: number;
  templateLimit: number;
  customDomainLimit: number;
  usagePercentage: {
    daily: number;
    monthlyEmails: number;
    monthlyRecipients: number;
    templates: number;
    domains: number;
  };
  lastResetDate: string;
  createdAt: string;
}

export interface UsageStats {
  totalTenants: number;
  activeTenantsToday: number;
  totalEmailsSentToday: number;
  totalEmailsSentThisMonth: number;
  averageUsageByTier: Record<SubscriptionTier, {
    dailyUsage: number;
    monthlyUsage: number;
    recipientUsage: number;
  }>;
  topUsageTenants: Array<{
    tenantName: string;
    userEmail: string;
    subscriptionTier: SubscriptionTier;
    monthlyEmailsSent: number;
    usagePercentage: number;
  }>;
}

export class AdminUsageService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async getTenantUsage(filters: UsageFilters = {}): Promise<ApiResponse<TenantUsage[]>> {
    const {
      tenantId,
      subscriptionTier,
      search,
      page = 1,
      limit = 20
    } = filters;

    let query = `
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        u.email as user_email,
        u.subscription_tier,
        s.daily_emails_sent,
        s.monthly_emails_sent,
        s.unique_recipients,
        s.templates_created,
        s.custom_domains_used,
        s.recharge_balance,
        s.last_reset_date,
        t.created_at,
        -- Get tier limits
        CASE u.subscription_tier
          WHEN 'free' THEN 100
          WHEN 'paid_standard' THEN 1000
          WHEN 'premium' THEN 5000
          ELSE 10000
        END as daily_limit,
        CASE u.subscription_tier
          WHEN 'free' THEN 2000
          WHEN 'paid_standard' THEN 30000
          WHEN 'premium' THEN 100000
          ELSE 500000
        END as monthly_email_limit,
        CASE u.subscription_tier
          WHEN 'free' THEN 300
          WHEN 'paid_standard' THEN 5000
          WHEN 'premium' THEN 25000
          ELSE 100000
        END as monthly_recipient_limit,
        CASE u.subscription_tier
          WHEN 'free' THEN 1
          WHEN 'paid_standard' THEN 10
          ELSE 999999
        END as template_limit,
        CASE u.subscription_tier
          WHEN 'premium' THEN 10
          WHEN 'enterprise' THEN 999999
          ELSE 0
        END as custom_domain_limit
      FROM tenants t
      JOIN users u ON t.id = u.tenant_id
      LEFT JOIN subscriptions s ON t.id = s.tenant_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (tenantId) {
      query += ` AND t.id = $${paramIndex}`;
      params.push(tenantId);
      paramIndex++;
    }

    if (subscriptionTier) {
      query += ` AND u.subscription_tier = $${paramIndex}`;
      params.push(subscriptionTier);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR t.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
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
    query += ` ORDER BY s.monthly_emails_sent DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const usage = result.rows.map(this.mapDbRowToTenantUsage);

    return {
      success: true,
      data: usage,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  async getUsageStats(): Promise<UsageStats> {
    const queries = [
      // Total tenants
      'SELECT COUNT(*) as total FROM tenants',
      
      // Active tenants today (sent emails)
      `SELECT COUNT(DISTINCT s.tenant_id) as active 
       FROM subscriptions s 
       WHERE s.daily_emails_sent > 0 AND s.last_reset_date >= CURRENT_DATE`,
      
      // Total emails sent today
      `SELECT COALESCE(SUM(s.daily_emails_sent), 0) as total
       FROM subscriptions s 
       WHERE s.last_reset_date >= CURRENT_DATE`,
      
      // Total emails sent this month
      `SELECT COALESCE(SUM(s.monthly_emails_sent), 0) as total
       FROM subscriptions s`,
      
      // Average usage by tier
      `SELECT 
         u.subscription_tier,
         AVG(s.daily_emails_sent) as avg_daily,
         AVG(s.monthly_emails_sent) as avg_monthly,
         AVG(s.unique_recipients) as avg_recipients
       FROM subscriptions s
       JOIN users u ON s.tenant_id = u.tenant_id
       GROUP BY u.subscription_tier`,
      
      // Top usage tenants
      `SELECT 
         t.name as tenant_name,
         u.email as user_email,
         u.subscription_tier,
         s.monthly_emails_sent,
         CASE u.subscription_tier
           WHEN 'free' THEN (s.monthly_emails_sent::float / 2000) * 100
           WHEN 'paid_standard' THEN (s.monthly_emails_sent::float / 30000) * 100
           WHEN 'premium' THEN (s.monthly_emails_sent::float / 100000) * 100
           ELSE (s.monthly_emails_sent::float / 500000) * 100
         END as usage_percentage
       FROM subscriptions s
       JOIN tenants t ON s.tenant_id = t.id
       JOIN users u ON t.id = u.tenant_id
       WHERE s.monthly_emails_sent > 0
       ORDER BY s.monthly_emails_sent DESC
       LIMIT 10`
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const averageUsageByTier = results[4].rows.reduce((acc, row) => {
      acc[row.subscription_tier as SubscriptionTier] = {
        dailyUsage: parseFloat(row.avg_daily || '0'),
        monthlyUsage: parseFloat(row.avg_monthly || '0'),
        recipientUsage: parseFloat(row.avg_recipients || '0')
      };
      return acc;
    }, {} as Record<SubscriptionTier, any>);

    return {
      totalTenants: parseInt(results[0].rows[0].total),
      activeTenantsToday: parseInt(results[1].rows[0].active || '0'),
      totalEmailsSentToday: parseInt(results[2].rows[0].total || '0'),
      totalEmailsSentThisMonth: parseInt(results[3].rows[0].total || '0'),
      averageUsageByTier,
      topUsageTenants: results[5].rows
    };
  }

  async updateTenantQuota(tenantId: string, quotaUpdates: {
    dailyLimit?: number;
    monthlyEmailLimit?: number;
    monthlyRecipientLimit?: number;
    templateLimit?: number;
    customDomainLimit?: number;
  }): Promise<void> {
    // This would typically update custom quota overrides in a separate table
    // For now, we'll update the subscription tier which determines limits
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Store custom quotas in tenant settings
    const customQuotas = JSON.stringify(quotaUpdates);
    
    await this.db.query(
      `UPDATE tenants 
       SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify({ customQuotas: quotaUpdates }), tenantId]
    );
  }

  async resetTenantUsage(tenantId: string, resetType: 'daily' | 'monthly' | 'all'): Promise<void> {
    let updateFields: string[] = [];
    
    switch (resetType) {
      case 'daily':
        updateFields = ['daily_emails_sent = 0'];
        break;
      case 'monthly':
        updateFields = ['monthly_emails_sent = 0', 'unique_recipients = 0'];
        break;
      case 'all':
        updateFields = [
          'daily_emails_sent = 0',
          'monthly_emails_sent = 0', 
          'unique_recipients = 0',
          'templates_created = 0'
        ];
        break;
    }

    if (updateFields.length > 0) {
      await this.db.query(
        `UPDATE subscriptions 
         SET ${updateFields.join(', ')}, 
             last_reset_date = NOW(),
             updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId]
      );
    }
  }

  private mapDbRowToTenantUsage(row: any): TenantUsage {
    const dailyUsage = row.daily_emails_sent || 0;
    const monthlyEmails = row.monthly_emails_sent || 0;
    const monthlyRecipients = row.unique_recipients || 0;
    const templates = row.templates_created || 0;
    const domains = row.custom_domains_used || 0;

    return {
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      userEmail: row.user_email,
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      dailyEmailsSent: dailyUsage,
      monthlyEmailsSent: monthlyEmails,
      uniqueRecipients: monthlyRecipients,
      templatesCreated: templates,
      customDomainsUsed: domains,
      rechargeBalance: parseFloat(row.recharge_balance || '0'),
      dailyLimit: row.daily_limit,
      monthlyEmailLimit: row.monthly_email_limit,
      monthlyRecipientLimit: row.monthly_recipient_limit,
      templateLimit: row.template_limit,
      customDomainLimit: row.custom_domain_limit,
      usagePercentage: {
        daily: row.daily_limit > 0 ? (dailyUsage / row.daily_limit) * 100 : 0,
        monthlyEmails: row.monthly_email_limit > 0 ? (monthlyEmails / row.monthly_email_limit) * 100 : 0,
        monthlyRecipients: row.monthly_recipient_limit > 0 ? (monthlyRecipients / row.monthly_recipient_limit) * 100 : 0,
        templates: row.template_limit > 0 ? (templates / row.template_limit) * 100 : 0,
        domains: row.custom_domain_limit > 0 ? (domains / row.custom_domain_limit) * 100 : 0
      },
      lastResetDate: row.last_reset_date,
      createdAt: row.created_at
    };
  }
}