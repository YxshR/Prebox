import { Request, Response } from 'express';
import { PaymentService, RechargeRequest } from './payment.service';
import { InvoiceService } from './invoice.service';
import { SubscriptionService } from './subscription.service';
import { User } from '../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  type: 'recharge' | 'subscription';
  planId?: string;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
}

export interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Payment Controller for handling payment-related API endpoints
 */
export class PaymentController {
  private paymentService: PaymentService;
  private invoiceService: InvoiceService;
  private subscriptionService: SubscriptionService;

  constructor(
    paymentService: PaymentService,
    invoiceService: InvoiceService,
    subscriptionService: SubscriptionService
  ) {
    this.paymentService = paymentService;
    this.invoiceService = invoiceService;
    this.subscriptionService = subscriptionService;
  }

  /**
   * Create payment intent for recharge or subscription
   */
  createPaymentIntent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id || !req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { amount, currency = 'inr', type, planId }: CreatePaymentIntentRequest = req.body;

      // Validate request
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Valid amount is required'
          }
        });
      }

      if (!['recharge', 'subscription'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Type must be either "recharge" or "subscription"'
          }
        });
      }

      if (type === 'subscription' && !planId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PLAN_ID',
            message: 'Plan ID is required for subscription payments'
          }
        });
      }

      // Validate recharge amount for recharge type
      if (type === 'recharge') {
        const subscription = await this.subscriptionService.getSubscriptionByTenantId(req.user.tenantId);
        if (subscription) {
          const plan = this.subscriptionService.getSubscriptionPlan(subscription.limits as any);
          if (plan?.rechargeOptions) {
            if (amount < plan.rechargeOptions.min || amount > plan.rechargeOptions.max) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_RECHARGE_AMOUNT',
                  message: `Recharge amount must be between ₹${plan.rechargeOptions.min} and ₹${plan.rechargeOptions.max}`
                }
              });
            }
          }
        }
      }

      // Create payment intent (this would normally be handled by frontend)
      const metadata = {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        type,
        planId: planId || '',
        timestamp: new Date().toISOString()
      };

      // For this implementation, we'll simulate the payment intent creation
      const paymentIntent = {
        id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clientSecret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        status: 'requires_payment_method',
        metadata
      };

      res.json({
        success: true,
        data: {
          paymentIntent,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_...'
        }
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_INTENT_CREATION_FAILED',
          message: 'Failed to create payment intent'
        }
      });
    }
  };

  /**
   * Process recharge payment
   */
  processRecharge = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id || !req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { amount, paymentMethodId, currency = 'inr' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Valid amount is required'
          }
        });
      }

      const rechargeRequest: RechargeRequest = {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        amount,
        currency,
        paymentMethodId,
        provider: 'stripe'
      };

      const paymentResult = await this.paymentService.processRecharge(rechargeRequest);

      if (paymentResult.success) {
        // Generate invoice
        const invoice = await this.invoiceService.generateRechargeInvoice(
          req.user,
          amount,
          paymentResult.paymentIntentId
        );

        res.json({
          success: true,
          data: {
            payment: paymentResult,
            invoice: invoice
          },
          message: `Successfully recharged ₹${amount} to your account`
        });
      } else {
        res.status(402).json({
          success: false,
          error: {
            code: 'PAYMENT_FAILED',
            message: paymentResult.error || 'Payment processing failed'
          }
        });
      }
    } catch (error) {
      console.error('Error processing recharge:', error);
      
      let errorCode = 'RECHARGE_PROCESSING_FAILED';
      let statusCode = 500;
      
      if (error instanceof Error) {
        if (error.message.includes('amount')) {
          errorCode = 'INVALID_RECHARGE_AMOUNT';
          statusCode = 400;
        } else if (error.message.includes('payment')) {
          errorCode = 'PAYMENT_PROCESSING_FAILED';
          statusCode = 402;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to process recharge'
        }
      });
    }
  };

  /**
   * Process subscription payment
   */
  processSubscriptionPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id || !req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { planId, paymentMethodId } = req.body;

      if (!planId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PLAN_ID',
            message: 'Plan ID is required'
          }
        });
      }

      // Get plan details
      const plans = this.subscriptionService.getAllSubscriptionPlans();
      const plan = plans.find(p => p.id === planId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: 'Subscription plan not found'
          }
        });
      }

      if (plan.priceInr === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FREE_PLAN_NO_PAYMENT',
            message: 'Free plan does not require payment'
          }
        });
      }

      const paymentResult = await this.paymentService.processSubscriptionPayment(
        req.user.id,
        req.user.tenantId,
        plan.priceInr,
        planId
      );

      if (paymentResult.success) {
        // Get current subscription
        const subscription = await this.subscriptionService.getSubscriptionByTenantId(req.user.tenantId);
        
        // Generate invoice
        const invoice = await this.invoiceService.generateSubscriptionInvoice(
          req.user,
          subscription!,
          plan.priceInr,
          plan.name,
          paymentResult.paymentIntentId
        );

        res.json({
          success: true,
          data: {
            payment: paymentResult,
            invoice: invoice,
            plan: plan
          },
          message: `Successfully upgraded to ${plan.name} plan`
        });
      } else {
        res.status(402).json({
          success: false,
          error: {
            code: 'PAYMENT_FAILED',
            message: paymentResult.error || 'Payment processing failed'
          }
        });
      }
    } catch (error) {
      console.error('Error processing subscription payment:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_PAYMENT_FAILED',
          message: 'Failed to process subscription payment'
        }
      });
    }
  };

  /**
   * Get payment history for user
   */
  getPaymentHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { limit = 50, offset = 0 } = req.query;

      const invoices = await this.invoiceService.getInvoicesByTenant(
        req.user.tenantId,
        Number(limit),
        Number(offset)
      );

      const stats = await this.invoiceService.getInvoiceStats(req.user.tenantId);

      res.json({
        success: true,
        data: {
          invoices,
          stats,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: stats.totalInvoices
          }
        }
      });
    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_HISTORY_FETCH_FAILED',
          message: 'Failed to fetch payment history'
        }
      });
    }
  };

  /**
   * Get invoice by ID
   */
  getInvoice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { invoiceId } = req.params;

      const invoice = await this.invoiceService.getInvoiceById(invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'INVOICE_NOT_FOUND',
            message: 'Invoice not found'
          }
        });
      }

      // Verify invoice belongs to user's tenant
      if (invoice.metadata?.tenantId !== req.user.tenantId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INVOICE_ACCESS_DENIED',
            message: 'Access denied to this invoice'
          }
        });
      }

      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INVOICE_FETCH_FAILED',
          message: 'Failed to fetch invoice'
        }
      });
    }
  };

  /**
   * Download invoice PDF
   */
  downloadInvoicePDF = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.tenantId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { invoiceId } = req.params;

      const invoice = await this.invoiceService.getInvoiceById(invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'INVOICE_NOT_FOUND',
            message: 'Invoice not found'
          }
        });
      }

      // Verify invoice belongs to user's tenant
      if (invoice.metadata?.tenantId !== req.user.tenantId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INVOICE_ACCESS_DENIED',
            message: 'Access denied to this invoice'
          }
        });
      }

      const pdfBuffer = await this.invoiceService.generateInvoicePDF(invoiceId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PDF_GENERATION_FAILED',
          message: 'Failed to generate invoice PDF'
        }
      });
    }
  };

  /**
   * Handle Stripe webhooks
   */
  handleStripeWebhook = async (req: WebhookRequest, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('Stripe webhook secret not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      // TODO: Verify webhook signature with Stripe
      // For now, we'll process the event without verification
      const event = req.body;

      await this.paymentService.handleWebhook('stripe', {
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created
      });

      res.json({ received: true });
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(400).json({
        error: 'Webhook processing failed'
      });
    }
  };

  /**
   * Handle Razorpay webhooks
   */
  handleRazorpayWebhook = async (req: WebhookRequest, res: Response) => {
    try {
      // TODO: Verify webhook signature with Razorpay
      const event = req.body;

      await this.paymentService.handleWebhook('razorpay', {
        id: event.id || `razorpay_${Date.now()}`,
        type: event.event,
        data: event.payload,
        created: Math.floor(Date.now() / 1000)
      });

      res.json({ status: 'ok' });
    } catch (error) {
      console.error('Error handling Razorpay webhook:', error);
      res.status(400).json({
        error: 'Webhook processing failed'
      });
    }
  };
}