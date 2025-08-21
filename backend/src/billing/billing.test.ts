import { PaymentService, StripePaymentProvider, RazorpayPaymentProvider } from './payment.service';
import { InvoiceService } from './invoice.service';
import { WalletService } from './wallet.service';
import { PaymentRetryService } from './payment-retry.service';
import { SubscriptionService } from './subscription.service';
import { User, SubscriptionTier, BillingSubscriptionStatus } from '../shared/types';

// Mock environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.RAZORPAY_KEY_ID = 'rzp_test_mock';
process.env.RAZORPAY_KEY_SECRET = 'mock_secret';

describe('Billing System Tests', () => {
  let paymentService: PaymentService;
  let invoiceService: InvoiceService;
  let walletService: WalletService;
  let subscriptionService: SubscriptionService;
  let paymentRetryService: PaymentRetryService;

  const mockUser: User = {
    id: 'user_123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: 'tenant_123',
    role: 'user' as any,
    subscriptionTier: SubscriptionTier.FREE,
    isEmailVerified: true,
    isPhoneVerified: false,
    createdAt: new Date(),
    lastLoginAt: new Date()
  };

  beforeEach(() => {
    paymentService = new PaymentService();
    invoiceService = new InvoiceService();
    walletService = new WalletService();
    subscriptionService = new SubscriptionService();
    paymentRetryService = new PaymentRetryService(paymentService, invoiceService);
  });

  describe('SubscriptionService', () => {
    test('should initialize subscription plans correctly', () => {
      const plans = subscriptionService.getAllSubscriptionPlans();
      expect(plans).toHaveLength(4);
      
      const freePlan = plans.find(p => p.tier === SubscriptionTier.FREE);
      expect(freePlan).toBeDefined();
      expect(freePlan?.priceInr).toBe(0);
      expect(freePlan?.limits.dailyEmailLimit).toBe(100);
    });

    test('should create subscription for new user', async () => {
      const subscription = await subscriptionService.createSubscription('tenant_123', SubscriptionTier.FREE);
      
      expect(subscription.tenantId).toBe('tenant_123');
      expect(subscription.status).toBe(BillingSubscriptionStatus.ACTIVE);
      expect(subscription.limits.dailyEmailLimit).toBe(100);
    });

    test('should validate quota limits correctly', async () => {
      const quotaResult = await subscriptionService.checkQuota('tenant_123', 'daily_emails', 50);
      
      expect(quotaResult.quotaType).toBe('daily_emails');
      expect(quotaResult.currentUsage).toBe(0);
    });
  });

  describe('PaymentService', () => {
    test('should validate recharge amounts', async () => {
      const rechargeRequest = {
        userId: 'user_123',
        tenantId: 'tenant_123',
        amount: 25, // Below minimum
        currency: 'inr',
        provider: 'stripe' as const
      };

      await expect(paymentService.processRecharge(rechargeRequest))
        .rejects.toThrow('Minimum recharge amount is ₹50');
    });

    test('should handle webhook events', async () => {
      const webhookEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { id: 'pi_123', amount: 5000 },
        created: Math.floor(Date.now() / 1000)
      };

      // Should not throw
      await expect(paymentService.handleWebhook('stripe', webhookEvent))
        .resolves.not.toThrow();
    });
  });

  describe('InvoiceService', () => {
    test('should generate subscription invoice with GST', async () => {
      const mockSubscription = {
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'paid-standard-tier',
        status: BillingSubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        usage: {
          dailyEmailsSent: 0,
          monthlyEmailsSent: 0,
          uniqueRecipients: 0,
          templatesCreated: 0,
          customDomainsUsed: 0,
          lastResetDate: new Date()
        },
        limits: {
          dailyEmailLimit: 1000,
          monthlyRecipientLimit: 5000,
          monthlyEmailLimit: 30000,
          templateLimit: 10,
          customDomainLimit: 0,
          hasLogoCustomization: true,
          hasCustomDomains: false,
          hasAdvancedAnalytics: false
        },
        rechargeBalance: 0
      };

      const invoice = await invoiceService.generateSubscriptionInvoice(
        mockUser,
        mockSubscription,
        59,
        'Paid Standard',
        'pi_123'
      );

      expect(invoice.amount).toBe(59);
      expect(invoice.status).toBe('paid');
      expect(invoice.items).toHaveLength(2); // Base amount + GST
      
      const gstItem = invoice.items.find(item => item.description.includes('GST'));
      expect(gstItem).toBeDefined();
    });

    test('should generate recharge invoice', async () => {
      const invoice = await invoiceService.generateRechargeInvoice(
        mockUser,
        500,
        'pi_123'
      );

      expect(invoice.amount).toBe(500);
      expect(invoice.status).toBe('paid');
      expect(invoice.metadata?.type).toBe('recharge');
    });
  });

  describe('WalletService', () => {
    test('should add funds to wallet', async () => {
      const transaction = await walletService.addFunds({
        tenantId: 'tenant_123',
        amount: 500,
        paymentIntentId: 'pi_123',
        description: 'Test recharge'
      });

      expect(transaction.type).toBe('credit');
      expect(transaction.amount).toBe(500);
      expect(transaction.balanceAfter).toBe(500);
    });

    test('should check sufficient balance', async () => {
      const hasFunds = await walletService.hasSufficientBalance('tenant_123', 100);
      expect(typeof hasFunds).toBe('boolean');
    });

    test('should process usage deduction', async () => {
      // Mock wallet balance to have sufficient funds
      jest.spyOn(walletService, 'getWalletBalance').mockResolvedValue({
        tenantId: 'tenant_123',
        balance: 500,
        currency: 'inr',
        lastUpdated: new Date(),
        totalCredits: 500,
        totalDebits: 0,
        transactionCount: 1
      });

      const transaction = await walletService.processUsageDeduction(
        'tenant_123',
        'emails',
        100,
        0.5
      );

      expect(transaction?.type).toBe('debit');
      expect(transaction?.amount).toBe(50); // 100 * 0.5
    });

    test('should add bonus credits', async () => {
      const transaction = await walletService.addBonusCredits(
        'tenant_123',
        100,
        'Referral bonus'
      );

      expect(transaction.type).toBe('credit');
      expect(transaction.amount).toBe(100);
      expect(transaction.description).toContain('Referral bonus');
    });
  });

  describe('PaymentRetryService', () => {
    test('should record failed payment', async () => {
      const failedPayment = await paymentRetryService.recordFailedPayment(
        'tenant_123',
        'user_123',
        'pi_failed_123',
        59,
        'inr',
        'subscription',
        'Card declined'
      );

      expect(failedPayment.tenantId).toBe('tenant_123');
      expect(failedPayment.failureReason).toBe('Card declined');
      expect(failedPayment.retryCount).toBe(0);
      expect(failedPayment.maxRetriesReached).toBe(false);
    });

    test('should calculate next retry time', async () => {
      const failedPayment = await paymentRetryService.recordFailedPayment(
        'tenant_123',
        'user_123',
        'pi_failed_123',
        59,
        'inr',
        'subscription',
        'Card declined'
      );

      expect(failedPayment.nextRetryAt).toBeInstanceOf(Date);
      expect(failedPayment.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should start dunning process for subscription failures', async () => {
      const failedPayment = await paymentRetryService.recordFailedPayment(
        'tenant_123',
        'user_123',
        'pi_failed_123',
        59,
        'inr',
        'subscription',
        'Card declined'
      );

      const dunningProcess = await paymentRetryService.startDunningProcess(failedPayment);
      
      expect(dunningProcess.tenantId).toBe('tenant_123');
      expect(dunningProcess.status).toBe('active');
      expect(dunningProcess.actions).toHaveLength(5); // email, email, email, suspension, cancellation
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete recharge flow', async () => {
      // 1. Process recharge payment
      const rechargeRequest = {
        userId: 'user_123',
        tenantId: 'tenant_123',
        amount: 500,
        currency: 'inr',
        provider: 'stripe' as const
      };

      // Mock successful payment
      jest.spyOn(paymentService as any, 'confirmPaymentWithRetry')
        .mockResolvedValue({
          success: true,
          paymentIntentId: 'pi_123',
          status: 'succeeded',
          amount: 500,
          currency: 'inr'
        });

      const paymentResult = await paymentService.processRecharge(rechargeRequest);
      expect(paymentResult.success).toBe(true);

      // 2. Add funds to wallet
      const walletTransaction = await walletService.addFunds({
        tenantId: 'tenant_123',
        amount: 500,
        paymentIntentId: paymentResult.paymentIntentId
      });

      expect(walletTransaction.amount).toBe(500);

      // 3. Generate invoice
      const invoice = await invoiceService.generateRechargeInvoice(
        mockUser,
        500,
        paymentResult.paymentIntentId
      );

      expect(invoice.amount).toBe(500);
      expect(invoice.status).toBe('paid');
    });

    test('should handle subscription upgrade flow', async () => {
      // 1. Get subscription plans
      const plans = subscriptionService.getAllSubscriptionPlans();
      const paidPlan = plans.find(p => p.tier === SubscriptionTier.PAID_STANDARD);
      expect(paidPlan).toBeDefined();

      // 2. Mock successful payment
      jest.spyOn(paymentService as any, 'confirmPaymentWithRetry')
        .mockResolvedValue({
          success: true,
          paymentIntentId: 'pi_sub_123',
          status: 'succeeded',
          amount: paidPlan!.priceInr,
          currency: 'inr'
        });

      // 3. Process subscription payment
      const paymentResult = await paymentService.processSubscriptionPayment(
        'user_123',
        'tenant_123',
        paidPlan!.priceInr,
        paidPlan!.id
      );

      expect(paymentResult.success).toBe(true);

      // 4. Mock existing subscription for upgrade
      const mockSubscription = {
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'free-tier',
        status: BillingSubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        usage: {
          dailyEmailsSent: 0,
          monthlyEmailsSent: 0,
          uniqueRecipients: 0,
          templatesCreated: 0,
          customDomainsUsed: 0,
          lastResetDate: new Date()
        },
        limits: paidPlan!.limits,
        rechargeBalance: 0
      };

      jest.spyOn(subscriptionService, 'getSubscriptionByUserId').mockResolvedValue(mockSubscription);

      // 5. Upgrade subscription tier
      const upgradeRequest = {
        userId: 'user_123',
        currentTier: SubscriptionTier.FREE,
        targetTier: SubscriptionTier.PAID_STANDARD
      };

      const updatedSubscription = await subscriptionService.changeTier(upgradeRequest);
      expect(updatedSubscription.limits.dailyEmailLimit).toBe(1000);
    });

    test('should handle payment failure and retry flow', async () => {
      // 1. Record failed payment
      const failedPayment = await paymentRetryService.recordFailedPayment(
        'tenant_123',
        'user_123',
        'pi_failed_123',
        59,
        'inr',
        'subscription',
        'Insufficient funds'
      );

      expect(failedPayment.retryCount).toBe(0);

      // 2. Mock the getFailedPayment method to return the failed payment
      jest.spyOn(paymentRetryService as any, 'getFailedPayment').mockResolvedValue(failedPayment);

      // 3. Mock retry attempt that fails
      jest.spyOn(paymentService as any, 'confirmPaymentWithRetry')
        .mockResolvedValue({
          success: false,
          paymentIntentId: 'pi_failed_123',
          status: 'failed',
          amount: 59,
          currency: 'inr',
          error: 'Card declined'
        });

      // 4. Attempt retry
      const retryResult = await paymentRetryService.retryPayment(failedPayment.id);
      expect(retryResult.success).toBe(false);
      expect(retryResult.retryScheduled).toBe(true);
      expect(retryResult.nextRetryAt).toBeInstanceOf(Date);
    });
  });
});

// Mock implementations for testing
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_mock',
        client_secret: 'pi_mock_secret',
        amount: 5000,
        currency: 'inr',
        status: 'requires_payment_method',
        metadata: {}
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_mock',
        status: 'succeeded',
        amount: 5000,
        currency: 'inr'
      })
    },
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_mock',
        email: 'test@example.com',
        name: 'John Doe',
        metadata: {}
      })
    }
  }));
});

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_mock',
        amount: 5000,
        currency: 'INR',
        status: 'created',
        notes: {}
      }),
      fetch: jest.fn().mockResolvedValue({
        id: 'order_mock',
        amount: 5000,
        currency: 'INR',
        status: 'paid'
      })
    },
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cust_mock',
        email: 'test@example.com',
        name: 'John Doe',
        notes: {}
      })
    }
  }));
});