# Billing System

This module implements a comprehensive billing system for the bulk email platform, including subscription management, payment processing, invoice generation, wallet functionality, and payment retry logic.

## Features

- **Multi-tier subscription management** (Free, Paid Standard, Premium, Enterprise)
- **Payment processing** with Stripe and Razorpay integration
- **Recharge wallet functionality** for prepaid usage
- **Invoice generation system** with GST calculation and PDF export
- **Payment retry logic** with exponential backoff and dunning management
- **Usage tracking and quota enforcement**
- **Automatic tier assignment** for new users
- **Webhook handling** for real-time payment updates

## Components

### Core Services

#### SubscriptionService
Manages subscription plans, user tiers, and usage tracking.

#### PaymentService
Handles payment processing with multiple providers (Stripe, Razorpay).

#### InvoiceService
Generates invoices for subscriptions, recharges, and usage with GST compliance.

#### WalletService
Manages recharge wallet functionality for prepaid usage.

#### PaymentRetryService
Handles payment failures with retry logic and dunning management.

### Controllers

#### SubscriptionController
Handles HTTP requests for subscription operations.

#### PaymentController
Manages payment-related API endpoints.

### Middleware

#### QuotaMiddleware
Enforces usage limits based on subscription tiers.

## Subscription Tiers

### Free Tier
- **Daily Limit**: 100 emails
- **Monthly Recipients**: 300
- **Monthly Emails**: 2,000
- **AI Templates**: 1 per day
- **Features**: Ads included, website branding
- **History**: 3 days
- **Price**: Free

### Paid Standard (₹39-59 + GST)
- **Daily Limit**: 500-1,000 emails
- **Monthly Recipients**: 1,500-5,000
- **Monthly Emails**: 10,000-30,000
- **AI Templates**: 10 per day
- **Features**: Logo customization, website branding
- **History**: Full history
- **Recharge**: ₹50-1,000 + GST

### Premium (₹249-649 + GST)
- **Daily Limit**: 2,000-5,000 emails
- **Monthly Recipients**: 10,000-25,000
- **Monthly Emails**: 50,000-100,000
- **AI Templates**: Unlimited
- **Features**: Custom business emails (2-10), full subscriber management
- **History**: Complete history
- **Recharge**: ₹1,500-10,000 + GST

### Enterprise (Custom pricing)
- **Limits**: Fully customizable
- **Features**: Complete feature access, dedicated support
- **Customization**: Full branding and feature control

## Usage

### Basic Setup

```typescript
import { 
  SubscriptionService, 
  PaymentService, 
  InvoiceService, 
  WalletService,
  PaymentRetryService 
} from './billing';

// Initialize services
const subscriptionService = new SubscriptionService();
const paymentService = new PaymentService();
const invoiceService = new InvoiceService();
const walletService = new WalletService();
const paymentRetryService = new PaymentRetryService(paymentService, invoiceService);
```

### Payment Processing

```typescript
// Process recharge payment
const rechargeRequest = {
  userId: 'user-123',
  tenantId: 'tenant-123',
  amount: 500,
  currency: 'inr',
  provider: 'stripe' as const
};

const paymentResult = await paymentService.processRecharge(rechargeRequest);

if (paymentResult.success) {
  // Add funds to wallet
  await walletService.addFunds({
    tenantId: 'tenant-123',
    amount: 500,
    paymentIntentId: paymentResult.paymentIntentId
  });
}
```

### Invoice Generation

```typescript
// Generate subscription invoice
const invoice = await invoiceService.generateSubscriptionInvoice(
  user,
  subscription,
  59, // Amount
  'Paid Standard',
  'pi_123' // Payment intent ID
);

// Download invoice PDF
const pdfBuffer = await invoiceService.generateInvoicePDF(invoice.id);
```

### Wallet Operations

```typescript
// Check wallet balance
const balance = await walletService.getWalletBalance('tenant-123');

// Process usage deduction
const transaction = await walletService.processUsageDeduction(
  'tenant-123',
  'emails',
  100, // quantity
  0.5  // unit rate
);

// Add bonus credits
await walletService.addBonusCredits(
  'tenant-123',
  100,
  'Referral bonus'
);
```

### Payment Retry & Dunning

```typescript
// Record failed payment
const failedPayment = await paymentRetryService.recordFailedPayment(
  'tenant-123',
  'user-123',
  'pi_failed_123',
  59,
  'inr',
  'subscription',
  'Card declined'
);

// Retry payment
const retryResult = await paymentRetryService.retryPayment(failedPayment.id);

// Process retry queue (typically run as a cron job)
await paymentRetryService.processRetryQueue();
```

## API Endpoints

### Subscription Management
- `GET /api/subscriptions/plans` - Get all subscription plans
- `GET /api/subscriptions/current` - Get current user subscription
- `POST /api/subscriptions/change-tier` - Upgrade/downgrade subscription
- `GET /api/subscriptions/usage` - Get usage statistics
- `GET /api/subscriptions/check-quota` - Check quota limits

### Payment Processing
- `POST /api/payments/payment-intent` - Create payment intent
- `POST /api/payments/recharge` - Process recharge payment
- `POST /api/payments/subscription` - Process subscription payment
- `GET /api/payments/history` - Get payment history
- `GET /api/payments/invoice/:id` - Get specific invoice
- `GET /api/payments/invoice/:id/pdf` - Download invoice PDF

### Webhooks
- `POST /api/payments/webhook/stripe` - Stripe webhook handler
- `POST /api/payments/webhook/razorpay` - Razorpay webhook handler

## Payment Providers

### Stripe Integration
- Credit/debit card processing
- International payments
- Subscription management
- Webhook support for real-time updates

### Razorpay Integration
- Indian payment methods (UPI, Net Banking, Wallets)
- Local currency support
- Subscription billing
- Webhook notifications

## Invoice System

### Features
- **GST Compliance**: Automatic 18% GST calculation
- **Multiple Types**: Subscription, recharge, usage invoices
- **PDF Generation**: Downloadable invoice PDFs
- **Email Delivery**: Automatic invoice emails
- **Audit Trail**: Complete payment history

### Invoice Types
1. **Subscription Invoices**: Monthly/annual plan charges
2. **Recharge Invoices**: Wallet top-up transactions
3. **Usage Invoices**: Overage charges for exceeded limits

## Wallet System

### Features
- **Prepaid Balance**: Add funds for usage-based billing
- **Auto-deduction**: Automatic charges for overages
- **Transaction History**: Complete audit trail
- **Bonus Credits**: Promotional and referral credits
- **Low Balance Alerts**: Proactive notifications

### Transaction Types
- **Credit**: Recharges, bonuses, refunds
- **Debit**: Usage charges, subscription fees

## Payment Retry & Dunning

### Retry Logic
- **Exponential Backoff**: 15min, 1hr, 4hr, 12hr, 24hr intervals
- **Maximum Attempts**: 5 retry attempts
- **Smart Retry**: Different strategies per failure type

### Dunning Process
1. **Immediate**: Payment failure notification
2. **1 Hour**: First reminder email
3. **1 Day**: Second reminder email
4. **3 Days**: Final warning email
5. **7 Days**: Account suspension
6. **14 Days**: Subscription cancellation

## Error Handling

The billing system includes comprehensive error handling:

### Common Error Codes
- `QUOTA_EXCEEDED` (429): Usage limit exceeded
- `UNAUTHORIZED` (401): Authentication required
- `INVALID_TIER` (400): Invalid subscription tier
- `PAYMENT_FAILED` (402): Payment processing failed
- `SUBSCRIPTION_NOT_FOUND` (404): Subscription not found
- `INVOICE_NOT_FOUND` (404): Invoice not found
- `INSUFFICIENT_BALANCE` (402): Insufficient wallet balance
- `RECHARGE_NOT_AVAILABLE` (403): Recharge not available for tier

### Payment-Specific Errors
- `PAYMENT_INTENT_CREATION_FAILED` (500): Failed to create payment intent
- `INVALID_AMOUNT` (400): Invalid payment amount
- `INVALID_RECHARGE_AMOUNT` (400): Amount outside allowed range
- `WEBHOOK_PROCESSING_FAILED` (400): Webhook validation failed

## Testing

Run the comprehensive test suite:

```bash
npm test -- --testPathPattern=billing.test.ts
```

### Test Coverage
- Unit tests for all services
- Integration tests for payment flows
- Mock implementations for external services
- Error handling and edge cases
- Webhook processing
- Invoice generation
- Wallet operations
- Payment retry logic

## Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...

# Company Details (for invoices)
COMPANY_NAME=Bulk Email Platform
COMPANY_ADDRESS=123 Business Street
COMPANY_CITY=Mumbai
COMPANY_STATE=Maharashtra
COMPANY_POSTAL_CODE=400001
COMPANY_COUNTRY=India
COMPANY_TAX_ID=GSTIN123456789
COMPANY_EMAIL=billing@bulkemailplatform.com
COMPANY_PHONE=+91-9876543210
```

## Security & Compliance

### Payment Security
- **PCI Compliance**: Secure payment processing through certified providers
- **Webhook Verification**: Signed webhook validation for all providers
- **Encryption**: All sensitive data encrypted at rest and in transit
- **Audit Logging**: Complete transaction and access logs

### Regulatory Compliance
- **GST**: Indian tax compliance with proper invoice generation
- **Data Protection**: GDPR/DPDP compliance for payment data
- **Financial Records**: Proper invoice and transaction management

## Integration

### With Other Modules
1. **Email Service**: Quota enforcement on email sending
2. **Template Service**: AI template usage tracking
3. **Contact Service**: Recipient limit enforcement
4. **Domain Service**: Custom domain quota validation
5. **Analytics Service**: Usage metrics for billing

### Database Integration
The billing system is designed to integrate with:
- PostgreSQL for transactional data
- Redis for caching and session management
- File storage for invoice PDFs

## Monitoring & Alerts

### Key Metrics
- **Payment Success/Failure Rates**: Real-time monitoring
- **Quota Usage Patterns**: Usage analytics and trends
- **Failed Payment Tracking**: Dunning process effectiveness
- **Revenue Metrics**: Business intelligence dashboards
- **Wallet Balance Alerts**: Low balance notifications

### Recommended Monitoring
- Payment processing latency
- Webhook delivery success rates
- Invoice generation performance
- Retry queue processing times
- Dunning action effectiveness

## Future Enhancements

### Planned Features
- **Database Integration**: Persistent storage implementation
- **Advanced Analytics**: Usage pattern analysis
- **Multi-currency Support**: International payment processing
- **Enterprise Billing**: Custom pricing and invoicing
- **API Rate Limiting**: Advanced quota management
- **Automated Reconciliation**: Payment matching and verification

### Scalability Considerations
- **Queue-based Processing**: Async payment processing
- **Microservice Architecture**: Service separation for scaling
- **Caching Strategy**: Redis-based performance optimization
- **Load Balancing**: Multi-instance payment processing