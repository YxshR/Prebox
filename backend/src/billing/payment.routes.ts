import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { InvoiceService } from './invoice.service';
import { SubscriptionService } from './subscription.service';
import { authMiddleware } from '../auth/auth.middleware';

// Initialize services
const paymentService = new PaymentService();
const invoiceService = new InvoiceService();
const subscriptionService = new SubscriptionService();

// Initialize controller
const paymentController = new PaymentController(
  paymentService,
  invoiceService,
  subscriptionService
);

const router = Router();

/**
 * Payment Intent Routes
 */
// Create payment intent for recharge or subscription
router.post('/payment-intent', authMiddleware, paymentController.createPaymentIntent);

/**
 * Payment Processing Routes
 */
// Process recharge payment
router.post('/recharge', authMiddleware, paymentController.processRecharge);

// Process subscription payment
router.post('/subscription', authMiddleware, paymentController.processSubscriptionPayment);

/**
 * Payment History and Invoice Routes
 */
// Get payment history for authenticated user
router.get('/history', authMiddleware, paymentController.getPaymentHistory);

// Get specific invoice by ID
router.get('/invoice/:invoiceId', authMiddleware, paymentController.getInvoice);

// Download invoice PDF
router.get('/invoice/:invoiceId/pdf', authMiddleware, paymentController.downloadInvoicePDF);

/**
 * Webhook Routes (no authentication required)
 */
// Stripe webhook endpoint
router.post('/webhook/stripe', paymentController.handleStripeWebhook);

// Razorpay webhook endpoint
router.post('/webhook/razorpay', paymentController.handleRazorpayWebhook);

/**
 * Health check route
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Payment service is healthy',
    timestamp: new Date().toISOString()
  });
});

export { router as paymentRoutes, paymentService, invoiceService };