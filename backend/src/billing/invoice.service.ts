import { InvoiceData, InvoiceItem } from './payment.service';
import { User, Subscription, SubscriptionTier } from '../shared/types';

export interface InvoiceTemplate {
  id: string;
  name: string;
  type: 'subscription' | 'recharge' | 'usage';
  template: string;
}

export interface InvoiceGenerationRequest {
  userId: string;
  tenantId: string;
  type: 'subscription' | 'recharge' | 'usage';
  amount: number;
  currency: string;
  items: InvoiceItem[];
  dueDate?: Date;
  metadata?: Record<string, any>;
}

export interface InvoiceEmailData {
  recipientEmail: string;
  recipientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: Date;
  items: InvoiceItem[];
  companyDetails: CompanyDetails;
}

export interface CompanyDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId: string;
  email: string;
  phone: string;
}

export interface InvoiceStats {
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  pendingRevenue: number;
}

/**
 * Invoice Service for generating and managing invoices
 */
export class InvoiceService {
  private companyDetails: CompanyDetails;

  constructor() {
    this.companyDetails = {
      name: process.env.COMPANY_NAME || 'Bulk Email Platform',
      address: process.env.COMPANY_ADDRESS || '123 Business Street',
      city: process.env.COMPANY_CITY || 'Mumbai',
      state: process.env.COMPANY_STATE || 'Maharashtra',
      postalCode: process.env.COMPANY_POSTAL_CODE || '400001',
      country: process.env.COMPANY_COUNTRY || 'India',
      taxId: process.env.COMPANY_TAX_ID || 'GSTIN123456789',
      email: process.env.COMPANY_EMAIL || 'billing@bulkemailplatform.com',
      phone: process.env.COMPANY_PHONE || '+91-9876543210'
    };
  }

  /**
   * Generate invoice for subscription payment
   */
  async generateSubscriptionInvoice(
    user: User,
    subscription: Subscription,
    planAmount: number,
    planName: string,
    paymentIntentId?: string
  ): Promise<InvoiceData> {
    const invoiceNumber = this.generateInvoiceNumber('SUB');
    const gstRate = 0.18; // 18% GST
    const baseAmount = planAmount / (1 + gstRate);
    const gstAmount = planAmount - baseAmount;

    const items: InvoiceItem[] = [
      {
        description: `${planName} Subscription Plan`,
        amount: baseAmount,
        quantity: 1,
        unitAmount: baseAmount
      },
      {
        description: 'GST (18%)',
        amount: gstAmount,
        quantity: 1,
        unitAmount: gstAmount
      }
    ];

    const invoice: InvoiceData = {
      id: invoiceNumber,
      subscriptionId: subscription.id,
      customerId: user.id,
      amount: planAmount,
      currency: 'inr',
      status: paymentIntentId ? 'paid' : 'open',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paidAt: paymentIntentId ? new Date() : undefined,
      items,
      metadata: {
        type: 'subscription',
        planName,
        paymentIntentId,
        tenantId: user.tenantId,
        userEmail: user.email,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        gstRate: gstRate.toString(),
        baseAmount: baseAmount.toString(),
        gstAmount: gstAmount.toString()
      }
    };

    // TODO: Save invoice to database
    await this.saveInvoice(invoice);

    // Send invoice email if paid
    if (paymentIntentId) {
      await this.sendInvoiceEmail(invoice, user);
    }

    return invoice;
  }

  /**
   * Generate invoice for recharge payment
   */
  async generateRechargeInvoice(
    user: User,
    rechargeAmount: number,
    paymentIntentId?: string
  ): Promise<InvoiceData> {
    const invoiceNumber = this.generateInvoiceNumber('RCH');
    const gstRate = 0.18; // 18% GST
    const baseAmount = rechargeAmount / (1 + gstRate);
    const gstAmount = rechargeAmount - baseAmount;

    const items: InvoiceItem[] = [
      {
        description: `Account Recharge - ₹${rechargeAmount}`,
        amount: baseAmount,
        quantity: 1,
        unitAmount: baseAmount
      },
      {
        description: 'GST (18%)',
        amount: gstAmount,
        quantity: 1,
        unitAmount: gstAmount
      }
    ];

    const invoice: InvoiceData = {
      id: invoiceNumber,
      subscriptionId: '', // Not applicable for recharge
      customerId: user.id,
      amount: rechargeAmount,
      currency: 'inr',
      status: paymentIntentId ? 'paid' : 'open',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paidAt: paymentIntentId ? new Date() : undefined,
      items,
      metadata: {
        type: 'recharge',
        paymentIntentId,
        tenantId: user.tenantId,
        userEmail: user.email,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        gstRate: gstRate.toString(),
        baseAmount: baseAmount.toString(),
        gstAmount: gstAmount.toString()
      }
    };

    // TODO: Save invoice to database
    await this.saveInvoice(invoice);

    // Send invoice email if paid
    if (paymentIntentId) {
      await this.sendInvoiceEmail(invoice, user);
    }

    return invoice;
  }

  /**
   * Generate usage-based invoice for overages
   */
  async generateUsageInvoice(
    user: User,
    subscription: Subscription,
    usageItems: InvoiceItem[],
    paymentIntentId?: string
  ): Promise<InvoiceData> {
    const invoiceNumber = this.generateInvoiceNumber('USG');
    const gstRate = 0.18; // 18% GST
    
    const subtotal = usageItems.reduce((sum, item) => sum + item.amount, 0);
    const baseAmount = subtotal / (1 + gstRate);
    const gstAmount = subtotal - baseAmount;

    const items: InvoiceItem[] = [
      ...usageItems.map(item => ({
        ...item,
        amount: item.amount / (1 + gstRate), // Remove GST from individual items
        unitAmount: item.unitAmount / (1 + gstRate)
      })),
      {
        description: 'GST (18%)',
        amount: gstAmount,
        quantity: 1,
        unitAmount: gstAmount
      }
    ];

    const invoice: InvoiceData = {
      id: invoiceNumber,
      subscriptionId: subscription.id,
      customerId: user.id,
      amount: subtotal,
      currency: 'inr',
      status: paymentIntentId ? 'paid' : 'open',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paidAt: paymentIntentId ? new Date() : undefined,
      items,
      metadata: {
        type: 'usage',
        paymentIntentId,
        tenantId: user.tenantId,
        userEmail: user.email,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        gstRate: gstRate.toString(),
        baseAmount: baseAmount.toString(),
        gstAmount: gstAmount.toString()
      }
    };

    // TODO: Save invoice to database
    await this.saveInvoice(invoice);

    // Send invoice email if paid
    if (paymentIntentId) {
      await this.sendInvoiceEmail(invoice, user);
    }

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<InvoiceData | null> {
    // TODO: Implement database query
    console.log(`Fetching invoice: ${invoiceId}`);
    return null;
  }

  /**
   * Get invoices for a user/tenant
   */
  async getInvoicesByTenant(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<InvoiceData[]> {
    // TODO: Implement database query
    console.log(`Fetching invoices for tenant: ${tenantId}`);
    return [];
  }

  /**
   * Get invoice statistics for a tenant
   */
  async getInvoiceStats(tenantId: string): Promise<InvoiceStats> {
    // TODO: Implement database aggregation query
    return {
      totalInvoices: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      overdueInvoices: 0,
      totalRevenue: 0,
      pendingRevenue: 0
    };
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(invoiceId: string, paymentIntentId: string): Promise<void> {
    // TODO: Update invoice status in database
    console.log(`Marking invoice ${invoiceId} as paid with payment ${paymentIntentId}`);
  }

  /**
   * Generate PDF invoice
   */
  async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // TODO: Implement PDF generation using a library like puppeteer or pdfkit
    // For now, return a placeholder
    const pdfContent = this.generateInvoiceHTML(invoice);
    return Buffer.from(pdfContent, 'utf-8');
  }

  /**
   * Send invoice email to customer
   */
  private async sendInvoiceEmail(invoice: InvoiceData, user: User): Promise<void> {
    const emailData: InvoiceEmailData = {
      recipientEmail: user.email,
      recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
      invoiceNumber: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      items: invoice.items,
      companyDetails: this.companyDetails
    };

    // TODO: Send email using email service
    console.log(`Sending invoice email to ${emailData.recipientEmail} for invoice ${invoice.id}`);
  }

  /**
   * Generate invoice number with prefix and timestamp
   */
  private generateInvoiceNumber(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Save invoice to database
   */
  private async saveInvoice(invoice: InvoiceData): Promise<void> {
    // TODO: Implement database save operation
    console.log(`Saving invoice: ${invoice.id}`);
  }

  /**
   * Generate HTML content for invoice
   */
  private generateInvoiceHTML(invoice: InvoiceData): string {
    const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;
    const formatDate = (date: Date) => date.toLocaleDateString('en-IN');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice ${invoice.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-details { margin-bottom: 20px; }
        .invoice-details { margin-bottom: 20px; }
        .customer-details { margin-bottom: 20px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; }
        .total-row { font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>INVOICE</h1>
        <h2>${invoice.id}</h2>
    </div>

    <div class="company-details">
        <h3>${this.companyDetails.name}</h3>
        <p>${this.companyDetails.address}<br>
        ${this.companyDetails.city}, ${this.companyDetails.state} ${this.companyDetails.postalCode}<br>
        ${this.companyDetails.country}<br>
        Email: ${this.companyDetails.email}<br>
        Phone: ${this.companyDetails.phone}<br>
        Tax ID: ${this.companyDetails.taxId}</p>
    </div>

    <div class="invoice-details">
        <p><strong>Invoice Date:</strong> ${formatDate(new Date())}</p>
        <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
        <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
        ${invoice.paidAt ? `<p><strong>Paid Date:</strong> ${formatDate(invoice.paidAt)}</p>` : ''}
    </div>

    <div class="customer-details">
        <h3>Bill To:</h3>
        <p>${invoice.metadata?.userName || 'Customer'}<br>
        ${invoice.metadata?.userEmail}<br>
        Customer ID: ${invoice.customerId}</p>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Amount</th>
                <th>Total Amount</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitAmount)}</td>
                    <td>${formatCurrency(item.amount)}</td>
                </tr>
            `).join('')}
            <tr class="total-row">
                <td colspan="3"><strong>Total Amount</strong></td>
                <td><strong>${formatCurrency(invoice.amount)}</strong></td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <p>Thank you for your business!</p>
        <p>This is a computer-generated invoice. No signature required.</p>
    </div>
</body>
</html>`;
  }
}