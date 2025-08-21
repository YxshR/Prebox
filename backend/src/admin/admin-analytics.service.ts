import { DatabaseService } from '../database/database.service';

export interface SystemMetrics {
  totalEmails: number;
  emailsToday: number;
  emailsThisWeek: number;
  emailsThisMonth: number;
  deliveryRate: number;
  bounceRate: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  complaintRate: number;
}

export interface EmailVolumeData {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
}

export interface TopPerformingCampaigns {
  campaignId: string;
  campaignName: string;
  tenantName: string;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  sentAt: Date;
}

export interface SystemHealth {
  queueSize: number;
  processingRate: number;
  errorRate: number;
  avgResponseTime: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class AdminAnalyticsService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const queries = [
      // Total emails
      'SELECT COUNT(*) as total FROM email_jobs',
      
      // Emails today
      'SELECT COUNT(*) as today FROM email_jobs WHERE created_at >= CURRENT_DATE',
      
      // Emails this week
      'SELECT COUNT(*) as week FROM email_jobs WHERE created_at >= DATE_TRUNC(\'week\', NOW())',
      
      // Emails this month
      'SELECT COUNT(*) as month FROM email_jobs WHERE created_at >= DATE_TRUNC(\'month\', NOW())',
      
      // Email metrics (last 30 days)
      `SELECT 
         COUNT(*) as total_sent,
         COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
         COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced
       FROM email_jobs 
       WHERE created_at >= NOW() - INTERVAL '30 days'`,
      
      // Engagement metrics (last 30 days)
      `SELECT 
         COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as opens,
         COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as clicks,
         COUNT(CASE WHEN event_type = 'unsubscribed' THEN 1 END) as unsubscribes,
         COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as complaints,
         COUNT(DISTINCT message_id) as unique_emails
       FROM email_events 
       WHERE timestamp >= NOW() - INTERVAL '30 days'`
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const totalSent = parseInt(results[4].rows[0].total_sent || '0');
    const delivered = parseInt(results[4].rows[0].delivered || '0');
    const bounced = parseInt(results[4].rows[0].bounced || '0');
    
    const opens = parseInt(results[5].rows[0].opens || '0');
    const clicks = parseInt(results[5].rows[0].clicks || '0');
    const unsubscribes = parseInt(results[5].rows[0].unsubscribes || '0');
    const complaints = parseInt(results[5].rows[0].complaints || '0');
    const uniqueEmails = parseInt(results[5].rows[0].unique_emails || '0');

    return {
      totalEmails: parseInt(results[0].rows[0].total),
      emailsToday: parseInt(results[1].rows[0].today),
      emailsThisWeek: parseInt(results[2].rows[0].week),
      emailsThisMonth: parseInt(results[3].rows[0].month),
      deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      openRate: uniqueEmails > 0 ? (opens / uniqueEmails) * 100 : 0,
      clickRate: uniqueEmails > 0 ? (clicks / uniqueEmails) * 100 : 0,
      unsubscribeRate: uniqueEmails > 0 ? (unsubscribes / uniqueEmails) * 100 : 0,
      complaintRate: uniqueEmails > 0 ? (complaints / uniqueEmails) * 100 : 0
    };
  }

  async getEmailVolumeData(days: number = 30): Promise<EmailVolumeData[]> {
    const query = `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as date
      ),
      email_stats AS (
        SELECT 
          DATE(ej.created_at) as date,
          COUNT(*) as sent,
          COUNT(CASE WHEN ej.status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN ej.status = 'bounced' THEN 1 END) as bounced
        FROM email_jobs ej
        WHERE ej.created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(ej.created_at)
      ),
      engagement_stats AS (
        SELECT 
          DATE(ee.timestamp) as date,
          COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END) as opened,
          COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END) as clicked
        FROM email_events ee
        WHERE ee.timestamp >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(ee.timestamp)
      )
      SELECT 
        ds.date::text,
        COALESCE(es.sent, 0) as sent,
        COALESCE(es.delivered, 0) as delivered,
        COALESCE(es.bounced, 0) as bounced,
        COALESCE(eng.opened, 0) as opened,
        COALESCE(eng.clicked, 0) as clicked
      FROM date_series ds
      LEFT JOIN email_stats es ON ds.date = es.date
      LEFT JOIN engagement_stats eng ON ds.date = eng.date
      ORDER BY ds.date
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  async getTopPerformingCampaigns(limit: number = 10): Promise<TopPerformingCampaigns[]> {
    const query = `
      SELECT 
        c.id as campaign_id,
        c.name as campaign_name,
        t.name as tenant_name,
        COUNT(ej.id) as total_sent,
        (COUNT(CASE WHEN ej.status = 'delivered' THEN 1 END)::float / COUNT(ej.id) * 100) as delivery_rate,
        (COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END)::float / COUNT(ej.id) * 100) as open_rate,
        (COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END)::float / COUNT(ej.id) * 100) as click_rate,
        c.sent_at
      FROM campaigns c
      JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN email_jobs ej ON c.id = ej.campaign_id
      LEFT JOIN email_events ee ON ej.message_id = ee.message_id
      WHERE c.status = 'sent' 
      AND c.sent_at >= NOW() - INTERVAL '30 days'
      GROUP BY c.id, c.name, t.name, c.sent_at
      HAVING COUNT(ej.id) > 0
      ORDER BY delivery_rate DESC, open_rate DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    // This would typically integrate with monitoring systems
    // For now, we'll provide basic database-derived metrics
    
    const queries = [
      // Queue size (pending email jobs)
      'SELECT COUNT(*) as queue_size FROM email_jobs WHERE status = \'pending\'',
      
      // Processing rate (emails processed in last hour)
      'SELECT COUNT(*) as processed FROM email_jobs WHERE updated_at >= NOW() - INTERVAL \'1 hour\' AND status != \'pending\'',
      
      // Error rate (failed emails in last hour)
      'SELECT COUNT(*) as errors FROM email_jobs WHERE updated_at >= NOW() - INTERVAL \'1 hour\' AND status = \'failed\'',
      
      // Active database connections
      'SELECT COUNT(*) as connections FROM pg_stat_activity WHERE state = \'active\'',
      
      // Database size
      'SELECT pg_size_pretty(pg_database_size(current_database())) as db_size'
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const queueSize = parseInt(results[0].rows[0].queue_size);
    const processed = parseInt(results[1].rows[0].processed);
    const errors = parseInt(results[2].rows[0].errors);

    return {
      queueSize,
      processingRate: processed,
      errorRate: processed > 0 ? (errors / processed) * 100 : 0,
      avgResponseTime: 0, // Would need application metrics
      activeConnections: parseInt(results[3].rows[0].connections),
      memoryUsage: 0, // Would need system metrics
      cpuUsage: 0 // Would need system metrics
    };
  }

  async getTenantUsageStats(limit: number = 20): Promise<any[]> {
    const query = `
      SELECT 
        t.id,
        t.name,
        u.email as owner_email,
        u.subscription_tier,
        s.status as subscription_status,
        COUNT(ej.id) as emails_sent,
        COUNT(CASE WHEN ej.created_at >= CURRENT_DATE THEN 1 END) as emails_today,
        COUNT(CASE WHEN ej.created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as emails_this_month,
        s.recharge_balance,
        t.created_at
      FROM tenants t
      JOIN users u ON t.id = u.tenant_id
      LEFT JOIN subscriptions s ON t.id = s.tenant_id
      LEFT JOIN email_jobs ej ON t.id = ej.tenant_id
      GROUP BY t.id, t.name, u.email, u.subscription_tier, s.status, s.recharge_balance, t.created_at
      ORDER BY emails_sent DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows;
  }

  async getDeliverabilityTrends(days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        DATE(ej.created_at) as date,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN ej.status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN ej.status = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN ej.status = 'failed' THEN 1 END) as failed,
        (COUNT(CASE WHEN ej.status = 'delivered' THEN 1 END)::float / COUNT(*) * 100) as delivery_rate
      FROM email_jobs ej
      WHERE ej.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(ej.created_at)
      ORDER BY date
    `;

    const result = await this.db.query(query);
    return result.rows;
  }
}