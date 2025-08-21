import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { User, Subscription } from '../shared/types';

export interface PaymentProvider {
  name: 'stripe' | 'razorpay';
  createPaymentIntent(amount: number, currency: string, metadata?: Record<string, any>): Promise<PaymentIntent>;
  confirmPayment(paymentIntentId: string): Promise<PaymentResult>;
  createCustomer(user: User): Promise<Customer>;
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  createSubscription(customerId: string, priceId: string): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  processRefund(paymentIntentId: string, amount?: number): Promise<RefundResult>;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  error?: string;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionResult {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  customerId: string;
  priceId: string;
}

export interface RefundResult {
  id: string;
  amount: number;
  status: string;
  reason?: string;
}

export interface PaymentWebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

export interface RechargeRequest {
  userId: string;
  tenantId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  provider: 'stripe' | 'razorpay';
}

export interface InvoiceData {
  id: string;
  subscriptionId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  metadata?: Record<string, any>;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
  unitAmount: number;
}

/**
 * Stripe Payment Provider Implementation
 */
export class StripePaymentProvider implements PaymentProvider {
  name: 'stripe' = 'stripe';
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const isDemoMode = process.env.DEMO_MODE === 'true';
    
    if (!secretKey && !isDemoMode) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    if (isDemoMode) {
      console.log('⚠️ Payment service running in demo mode - Stripe disabled');
      // Don't initialize Stripe in demo mode
      return;
    }
    
    this.stripe = new Stripe(secretKey!, {
      apiVersion: '2023-10-16'
    });
  }

  async createPaymentIntent(
    amount: number, 
    currency: string = 'inr', 
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to smallest currency unit (paise for INR)
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true
        }
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100, // Convert back to rupees
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata
      };
    } catch (error) {
      console.error('Stripe payment intent creation failed:', error);
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        success: paymentIntent.status === 'succeeded',
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        error: paymentIntent.status === 'canceled' ? 'Payment failed' : undefined
      };
    } catch (error) {
      console.error('Stripe payment confirmation failed:', error);
      return {
        success: false,
        paymentIntentId,
        status: 'failed',
        amount: 0,
        currency: 'inr',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createCustomer(user: User): Promise<Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
        metadata: {
          userId: user.id,
          tenantId: user.tenantId,
          subscriptionTier: user.subscriptionTier
        }
      });

      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name || undefined,
        metadata: customer.metadata
      };
    } catch (error) {
      console.error('Stripe customer creation failed:', error);
      throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error) {
      console.error('Stripe payment method attachment failed:', error);
      throw new Error(`Failed to attach payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createSubscription(customerId: string, priceId: string): Promise<SubscriptionResult> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        customerId: subscription.customer as string,
        priceId
      };
    } catch (error) {
      console.error('Stripe subscription creation failed:', error);
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.error('Stripe subscription cancellation failed:', error);
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processRefund(paymentIntentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined
      });

      return {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status || 'pending',
        reason: refund.reason || undefined
      };
    } catch (error) {
      console.error('Stripe refund processing failed:', error);
      throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Razorpay Payment Provider Implementation
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  name: 'razorpay' = 'razorpay';
  private razorpay: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isDemoMode = process.env.DEMO_MODE === 'true';
    
    if (!keyId || !keySecret) {
      if (!isDemoMode) {
        throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required');
      }
      console.log('⚠️ Razorpay service running in demo mode - Razorpay disabled');
      return;
    }
    
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }

  async createPaymentIntent(
    amount: number, 
    currency: string = 'INR', 
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency.toUpperCase(),
        notes: metadata || {}
      });

      return {
        id: order.id,
        clientSecret: order.id, // Razorpay uses order ID as client secret
        amount: (order.amount as number) / 100, // Convert back to rupees
        currency: order.currency.toLowerCase(),
        status: order.status,
        metadata: order.notes
      };
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw new Error(`Failed to create payment order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      // In Razorpay, we need to verify the payment using payment ID
      // This is typically done via webhook or after payment completion
      const order = await this.razorpay.orders.fetch(paymentIntentId);
      
      return {
        success: order.status === 'paid',
        paymentIntentId: order.id,
        status: order.status,
        amount: (order.amount as number) / 100,
        currency: order.currency.toLowerCase(),
        error: order.status === 'attempted' ? 'Payment failed' : undefined
      };
    } catch (error) {
      console.error('Razorpay payment confirmation failed:', error);
      return {
        success: false,
        paymentIntentId,
        status: 'failed',
        amount: 0,
        currency: 'inr',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createCustomer(user: User): Promise<Customer> {
    try {
      const customer = await this.razorpay.customers.create({
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
        email: user.email,
        contact: user.phone || undefined,
        notes: {
          userId: user.id,
          tenantId: user.tenantId,
          subscriptionTier: user.subscriptionTier
        }
      });

      return {
        id: customer.id,
        email: customer.email || '',
        name: customer.name || undefined,
        metadata: customer.notes
      };
    } catch (error) {
      console.error('Razorpay customer creation failed:', error);
      throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Razorpay doesn't have a direct equivalent to Stripe's payment method attachment
    // Payment methods are typically handled during payment creation
    console.log(`Razorpay: Payment method ${paymentMethodId} associated with customer ${customerId}`);
  }

  async createSubscription(customerId: string, priceId: string): Promise<SubscriptionResult> {
    try {
      // Razorpay subscription creation
      const subscription = await this.razorpay.subscriptions.create({
        plan_id: priceId,
        customer_notify: 1,
        total_count: 12, // 12 months
        quantity: 1
      } as any);

      return {
        id: (subscription as any).id,
        status: (subscription as any).status,
        currentPeriodStart: new Date((subscription as any).current_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_end * 1000),
        customerId: customerId,
        priceId: priceId
      };
    } catch (error) {
      console.error('Razorpay subscription creation failed:', error);
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.razorpay.subscriptions.cancel(subscriptionId, true); // Cancel immediately
    } catch (error) {
      console.error('Razorpay subscription cancellation failed:', error);
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processRefund(paymentIntentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refund = await this.razorpay.payments.refund(paymentIntentId, {
        amount: amount ? Math.round(amount * 100) : undefined
      });

      return {
        id: refund.id,
        amount: (refund.amount || 0) / 100,
        status: refund.status || 'pending',
        reason: undefined
      };
    } catch (error) {
      console.error('Razorpay refund processing failed:', error);
      throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Payment Service - Main service for handling payments
 */
export class PaymentService {
  private stripeProvider: StripePaymentProvider;
  private razorpayProvider: RazorpayPaymentProvider;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // 1 second base delay

  constructor() {
    this.stripeProvider = new StripePaymentProvider();
    this.razorpayProvider = new RazorpayPaymentProvider();
  }

  /**
   * Process recharge payment with retry logic
   */
  async processRecharge(request: RechargeRequest): Promise<PaymentResult> {
    const { amount, currency = 'inr', provider = 'stripe' } = request;

    // Validate amount based on tier limits
    await this.validateRechargeAmount(request.tenantId, amount);

    const metadata = {
      userId: request.userId,
      tenantId: request.tenantId,
      type: 'recharge',
      timestamp: new Date().toISOString()
    };

    let lastError: Error | null = null;
    const paymentProvider = provider === 'razorpay' ? this.razorpayProvider : this.stripeProvider;

    // Retry logic for payment processing
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`Processing recharge payment attempt ${attempt}/${this.retryAttempts} using ${provider}`);

        const paymentIntent = await paymentProvider.createPaymentIntent(
          amount,
          currency,
          metadata
        );

        // In a real implementation, you would return the client secret to the frontend
        // and wait for confirmation. For this implementation, we'll simulate confirmation.
        const result = await this.confirmPaymentWithRetry(paymentIntent.id, provider);

        if (result.success) {
          // Update subscription balance
          await this.updateRechargeBalance(request.tenantId, amount);
          
          // Generate invoice
          await this.generateRechargeInvoice(request, result);
          
          return result;
        }

        lastError = new Error(result.error || 'Payment failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown payment error');
        console.error(`Payment attempt ${attempt} failed:`, lastError.message);

        if (attempt < this.retryAttempts) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Payment processing failed after all retry attempts');
  }

  /**
   * Process subscription upgrade payment
   */
  async processSubscriptionPayment(
    userId: string,
    tenantId: string,
    planAmount: number,
    planId: string,
    provider: 'stripe' | 'razorpay' = 'stripe'
  ): Promise<PaymentResult> {
    const metadata = {
      userId,
      tenantId,
      planId,
      type: 'subscription',
      timestamp: new Date().toISOString()
    };

    try {
      const paymentProvider = provider === 'razorpay' ? this.razorpayProvider : this.stripeProvider;
      
      const paymentIntent = await paymentProvider.createPaymentIntent(
        planAmount,
        'inr',
        metadata
      );

      const result = await this.confirmPaymentWithRetry(paymentIntent.id, provider);

      if (result.success) {
        // Generate subscription invoice
        await this.generateSubscriptionInvoice(userId, tenantId, planAmount, planId, result);
      }

      return result;
    } catch (error) {
      console.error('Subscription payment processing failed:', error);
      throw new Error(`Failed to process subscription payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle webhook events from payment providers
   */
  async handleWebhook(provider: 'stripe' | 'razorpay', event: PaymentWebhookEvent): Promise<void> {
    try {
      console.log(`Processing ${provider} webhook event: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSuccess(event.data);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailure(event.data);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(event.data);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private async confirmPaymentWithRetry(
    paymentIntentId: string, 
    provider: 'stripe' | 'razorpay' = 'stripe'
  ): Promise<PaymentResult> {
    let lastError: Error | null = null;
    const paymentProvider = provider === 'razorpay' ? this.razorpayProvider : this.stripeProvider;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await paymentProvider.confirmPayment(paymentIntentId);
        
        if (result.success || result.status === 'succeeded' || result.status === 'paid') {
          return result;
        }

        if (result.status === 'requires_payment_method' || result.status === 'requires_confirmation' || result.status === 'created') {
          // These statuses indicate the payment can be retried
          lastError = new Error(result.error || 'Payment requires additional action');
        } else {
          // Terminal failure states
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Payment confirmation failed');
      }

      if (attempt < this.retryAttempts) {
        await this.sleep(this.retryDelay * attempt);
      }
    }

    return {
      success: false,
      paymentIntentId,
      status: 'failed',
      amount: 0,
      currency: 'inr',
      error: lastError?.message || 'Payment confirmation failed after retries'
    };
  }

  private async validateRechargeAmount(tenantId: string, amount: number): Promise<void> {
    // TODO: Get subscription from database to check recharge limits
    // For now, implement basic validation
    if (amount < 50) {
      throw new Error('Minimum recharge amount is ₹50');
    }
    if (amount > 50000) {
      throw new Error('Maximum recharge amount is ₹50,000');
    }
  }

  private async updateRechargeBalance(tenantId: string, amount: number): Promise<void> {
    // TODO: Update subscription balance in database
    console.log(`Updated recharge balance for tenant ${tenantId}: +₹${amount}`);
  }

  private async generateRechargeInvoice(
    request: RechargeRequest,
    paymentResult: PaymentResult
  ): Promise<InvoiceData> {
    const invoice: InvoiceData = {
      id: `inv_recharge_${Date.now()}`,
      subscriptionId: '', // Not applicable for recharge
      customerId: request.userId,
      amount: request.amount,
      currency: request.currency,
      status: 'paid',
      dueDate: new Date(),
      paidAt: new Date(),
      items: [{
        description: `Account Recharge - ₹${request.amount}`,
        amount: request.amount,
        quantity: 1,
        unitAmount: request.amount
      }],
      metadata: {
        type: 'recharge',
        paymentIntentId: paymentResult.paymentIntentId,
        tenantId: request.tenantId
      }
    };

    // TODO: Save invoice to database
    console.log('Generated recharge invoice:', invoice.id);
    return invoice;
  }

  private async generateSubscriptionInvoice(
    userId: string,
    tenantId: string,
    amount: number,
    planId: string,
    paymentResult: PaymentResult
  ): Promise<InvoiceData> {
    const invoice: InvoiceData = {
      id: `inv_sub_${Date.now()}`,
      subscriptionId: `sub_${tenantId}`,
      customerId: userId,
      amount,
      currency: 'inr',
      status: 'paid',
      dueDate: new Date(),
      paidAt: new Date(),
      items: [{
        description: `Subscription Plan - ${planId}`,
        amount,
        quantity: 1,
        unitAmount: amount
      }],
      metadata: {
        type: 'subscription',
        planId,
        paymentIntentId: paymentResult.paymentIntentId,
        tenantId
      }
    };

    // TODO: Save invoice to database
    console.log('Generated subscription invoice:', invoice.id);
    return invoice;
  }

  private async handlePaymentSuccess(paymentData: any): Promise<void> {
    console.log('Payment succeeded:', paymentData.id);
    // TODO: Update payment status in database
    // TODO: Trigger success notifications
  }

  private async handlePaymentFailure(paymentData: any): Promise<void> {
    console.log('Payment failed:', paymentData.id);
    // TODO: Update payment status in database
    // TODO: Trigger failure notifications
    // TODO: Implement retry logic for failed payments
  }

  private async handleInvoicePaymentSuccess(invoiceData: any): Promise<void> {
    console.log('Invoice payment succeeded:', invoiceData.id);
    // TODO: Update invoice status in database
  }

  private async handleInvoicePaymentFailure(invoiceData: any): Promise<void> {
    console.log('Invoice payment failed:', invoiceData.id);
    // TODO: Update invoice status in database
    // TODO: Implement dunning management
  }

  private async handleSubscriptionCancellation(subscriptionData: any): Promise<void> {
    console.log('Subscription cancelled:', subscriptionData.id);
    // TODO: Update subscription status in database
    // TODO: Handle access revocation
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}