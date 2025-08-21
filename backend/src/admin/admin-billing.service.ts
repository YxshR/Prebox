import { DatabaseService } from '../database/database.service';
import { BillingSubscriptionStatus, SubscriptionTier, ApiResponse } from '../shared/types';

export interface InvoiceFilters {
  status?: 'paid' | 'pending' | 'failed' | 'refunded';
  subscriptionTier?: SubscriptionTier;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface AdminInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  subscriptionId: string;
  subscriptionTier: SubscriptionTier;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface RechargeTransaction {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  amount: number;
  recipientCount: number;
  pricePerRecipient: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  rechargeRevenue: number;
  subscriptionRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  failedInvoices: number;
  totalRechargeTransactions: number;
  averageInvoiceAmount: number;
  averageRechargeAmount: number;
  revenueByTier: Record<SubscriptionTier, number>;
  monthlyRevenueGrowth: number;
}

export class AdminBillingService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async getInvoices(filters: InvoiceFilters = {}): Promise<ApiResponse<AdminInvoice[]>> {
    const {
      status,
      subscriptionTier,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = filters;

    let query = `
      SELECT 
        i.id,
        i.tenant_id,
        t.name as tenant_name,
        u.email as user_email,
        i.subscription_id,
        u.subscription_tier,
        i.amount,
        i.currency,
        i.status,
        i.payment_method,
        i.transaction_id,
        i.invoice_number,
        i.billing_period_start,
        i.billing_period_end,
        i.due_date,
        i.paid_at,
        i.created_at,
        i.items
      FROM invoices i
      JOIN tenants t ON i.tenant_id = t.id
      JOIN users u ON t.id = u.tenant_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (subscriptionTier) {
      query += ` AND u.subscription_tier = $${paramIndex}`;
      params.push(subscriptionTier);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR t.name ILIKE $${paramIndex} OR i.invoice_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND i.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND i.created_at <= $${paramIndex}`;
      params.push(dateTo);
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
    query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const invoices = result.rows.map(this.mapDbRowToInvoice);

    return {
      success: true,
      data: invoices,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  async getRechargeTransactions(filters: Omit<InvoiceFilters, 'status'> & { 
    status?: 'completed' | 'pending' | 'failed' | 'refunded' 
  } = {}): Promise<ApiResponse<RechargeTransaction[]>> {
    const {
      status,
      subscriptionTier,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = filters;

    let query = `
      SELECT 
        rt.id,
        rt.tenant_id,
        t.name as tenant_name,
        u.email as user_email,
        rt.amount,
        rt.recipient_count,
        rt.price_per_recipient,
        rt.currency,
        rt.status,
        rt.payment_method,
        rt.transaction_id,
        rt.created_at,
        rt.completed_at
      FROM recharge_transactions rt
      JOIN tenants t ON rt.tenant_id = t.id
      JOIN users u ON t.id = u.tenant_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND rt.status = $${paramIndex}`;
      params.push(status);
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

    if (dateFrom) {
      query += ` AND rt.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND rt.created_at <= $${paramIndex}`;
      params.push(dateTo);
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
    query += ` ORDER BY rt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const transactions = result.rows.map(this.mapDbRowToRechargeTransaction);

    return {
      success: true,
      data: transactions,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  async getBillingStats(): Promise<BillingStats> {
    const queries = [
      // Total revenue (all time)
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM invoices 
       WHERE status = 'paid'`,
      
      // Monthly revenue (current month)
      `SELECT COALESCE(SUM(amount), 0) as monthly
       FROM invoices 
       WHERE status = 'paid' 
       AND created_at >= DATE_TRUNC('month', NOW())`,
      
      // Recharge revenue (all time)
      `SELECT COALESCE(SUM(amount), 0) as recharge
       FROM recharge_transactions 
       WHERE status = 'completed'`,
      
      // Subscription revenue (all time)
      `SELECT COALESCE(SUM(amount), 0) as subscription
       FROM invoices 
       WHERE status = 'paid'`,
      
      // Invoice counts
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
       FROM invoices`,
      
      // Recharge transaction count
      `SELECT COUNT(*) as total
       FROM recharge_transactions 
       WHERE status = 'completed'`,
      
      // Average amounts
      `SELECT 
         AVG(CASE WHEN i.status = 'paid' THEN i.amount END) as avg_invoice,
         AVG(CASE WHEN rt.status = 'completed' THEN rt.amount END) as avg_recharge
       FROM invoices i
       FULL OUTER JOIN recharge_transactions rt ON 1=1`,
      
      // Revenue by tier
      `SELECT 
         u.subscription_tier,
         COALESCE(SUM(i.amount), 0) as revenue
       FROM invoices i
       JOIN users u ON i.tenant_id = u.tenant_id
       WHERE i.status = 'paid'
       GROUP BY u.subscription_tier`,
      
      // Monthly revenue growth
      `SELECT 
         COALESCE(
           (current_month.revenue - previous_month.revenue) / NULLIF(previous_month.revenue, 0) * 100,
           0
         ) as growth
       FROM (
         SELECT COALESCE(SUM(amount), 0) as revenue
         FROM invoices 
         WHERE status = 'paid' 
         AND created_at >= DATE_TRUNC('month', NOW())
       ) current_month
       CROSS JOIN (
         SELECT COALESCE(SUM(amount), 0) as revenue
         FROM invoices 
         WHERE status = 'paid' 
         AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
         AND created_at < DATE_TRUNC('month', NOW())
       ) previous_month`
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const revenueByTier = results[7].rows.reduce((acc, row) => {
      acc[row.subscription_tier as SubscriptionTier] = parseFloat(row.revenue || '0');
      return acc;
    }, {} as Record<SubscriptionTier, number>);

    const invoiceCounts = results[4].rows[0];

    return {
      totalRevenue: parseFloat(results[0].rows[0].total || '0'),
      monthlyRevenue: parseFloat(results[1].rows[0].monthly || '0'),
      rechargeRevenue: parseFloat(results[2].rows[0].recharge || '0'),
      subscriptionRevenue: parseFloat(results[3].rows[0].subscription || '0'),
      totalInvoices: parseInt(invoiceCounts.total || '0'),
      paidInvoices: parseInt(invoiceCounts.paid || '0'),
      pendingInvoices: parseInt(invoiceCounts.pending || '0'),
      failedInvoices: parseInt(invoiceCounts.failed || '0'),
      totalRechargeTransactions: parseInt(results[5].rows[0].total || '0'),
      averageInvoiceAmount: parseFloat(results[6].rows[0].avg_invoice || '0'),
      averageRechargeAmount: parseFloat(results[6].rows[0].avg_recharge || '0'),
      revenueByTier,
      monthlyRevenueGrowth: parseFloat(results[8].rows[0].growth || '0')
    };
  }

  async markInvoiceAsPaid(invoiceId: string, transactionId?: string): Promise<void> {
    await this.db.query(
      `UPDATE invoices 
       SET status = 'paid',
           paid_at = NOW(),
           transaction_id = COALESCE($2, transaction_id),
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, transactionId]
    );
  }

  async refundInvoice(invoiceId: string, reason: string): Promise<void> {
    await this.db.query('BEGIN');

    try {
      // Update invoice status
      await this.db.query(
        `UPDATE invoices 
         SET status = 'refunded',
             refund_reason = $2,
             refunded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [invoiceId, reason]
      );

      // Add refund record
      await this.db.query(
        `INSERT INTO refunds (invoice_id, amount, reason, created_at)
         SELECT id, amount, $2, NOW()
         FROM invoices 
         WHERE id = $1`,
        [invoiceId, reason]
      );

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async generateInvoiceReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    subscriptionTier?: SubscriptionTier;
  }): Promise<{
    summary: {
      totalAmount: number;
      invoiceCount: number;
      averageAmount: number;
    };
    breakdown: Array<{
      tier: SubscriptionTier;
      count: number;
      amount: number;
    }>;
  }> {
    let whereClause = "WHERE i.status = 'paid'";
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.dateFrom) {
      whereClause += ` AND i.created_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND i.created_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.subscriptionTier) {
      whereClause += ` AND u.subscription_tier = $${paramIndex}`;
      params.push(filters.subscriptionTier);
      paramIndex++;
    }

    const summaryQuery = `
      SELECT 
        COUNT(*) as invoice_count,
        COALESCE(SUM(i.amount), 0) as total_amount,
        COALESCE(AVG(i.amount), 0) as average_amount
      FROM invoices i
      JOIN users u ON i.tenant_id = u.tenant_id
      ${whereClause}
    `;

    const breakdownQuery = `
      SELECT 
        u.subscription_tier as tier,
        COUNT(*) as count,
        COALESCE(SUM(i.amount), 0) as amount
      FROM invoices i
      JOIN users u ON i.tenant_id = u.tenant_id
      ${whereClause}
      GROUP BY u.subscription_tier
      ORDER BY amount DESC
    `;

    const [summaryResult, breakdownResult] = await Promise.all([
      this.db.query(summaryQuery, params),
      this.db.query(breakdownQuery, params)
    ]);

    return {
      summary: {
        totalAmount: parseFloat(summaryResult.rows[0].total_amount || '0'),
        invoiceCount: parseInt(summaryResult.rows[0].invoice_count || '0'),
        averageAmount: parseFloat(summaryResult.rows[0].average_amount || '0')
      },
      breakdown: breakdownResult.rows
    };
  }

  private mapDbRowToInvoice(row: any): AdminInvoice {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      userEmail: row.user_email,
      subscriptionId: row.subscription_id,
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as 'paid' | 'pending' | 'failed' | 'refunded',
      paymentMethod: row.payment_method,
      transactionId: row.transaction_id,
      invoiceNumber: row.invoice_number,
      billingPeriodStart: row.billing_period_start,
      billingPeriodEnd: row.billing_period_end,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      items: row.items || []
    };
  }

  private mapDbRowToRechargeTransaction(row: any): RechargeTransaction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      userEmail: row.user_email,
      amount: parseFloat(row.amount),
      recipientCount: parseInt(row.recipient_count),
      pricePerRecipient: parseFloat(row.price_per_recipient),
      currency: row.currency,
      status: row.status as 'completed' | 'pending' | 'failed' | 'refunded',
      paymentMethod: row.payment_method,
      transactionId: row.transaction_id,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }
}