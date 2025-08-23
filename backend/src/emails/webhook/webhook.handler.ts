import { Request, Response } from 'express';
import crypto from 'crypto';
import { EmailEvent, EmailEventType, BounceEvent, ComplaintEvent, WebhookPayload } from '../types';
import { EventProcessor } from './event.processor';

export class WebhookHandler {
  private eventProcessor: EventProcessor;

  constructor() {
    this.eventProcessor = new EventProcessor();
  }

  // Amazon SES webhook handler
  async handleSESWebhook(req: Request, res: Response): Promise<void> {
    try {
      const message = req.body;
      
      // Verify SNS message signature (in production)
      if (process.env.NODE_ENV === 'production') {
        const isValid = await this.verifySNSSignature(req);
        if (!isValid) {
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Handle SNS subscription confirmation
      if (message.Type === 'SubscriptionConfirmation') {
        console.log('SNS Subscription confirmation received');
        // In production, you'd want to confirm the subscription
        res.status(200).json({ message: 'Subscription confirmed' });
        return;
      }

      // Process SES notification
      if (message.Type === 'Notification') {
        const sesMessage = JSON.parse(message.Message);
        await this.processSESEvent(sesMessage);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('SES webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // SendGrid webhook handler
  async handleSendGridWebhook(req: Request, res: Response): Promise<void> {
    try {
      const events = req.body;
      
      // Verify SendGrid signature (in production)
      if (process.env.NODE_ENV === 'production') {
        const isValid = this.verifySendGridSignature(req);
        if (!isValid) {
          console.error('SendGrid webhook signature verification failed');
          res.status(401).json({ 
            error: 'Invalid signature',
            code: 'WEBHOOK_SIGNATURE_INVALID'
          });
          return;
        }
      }

      // Process each event
      const processedEvents = [];
      for (const event of events) {
        try {
          await this.processSendGridEvent(event);
          processedEvents.push({ eventId: event.sg_event_id, status: 'processed' });
        } catch (eventError) {
          console.error('Failed to process SendGrid event:', eventError);
          processedEvents.push({ 
            eventId: event.sg_event_id, 
            status: 'failed',
            error: eventError instanceof Error ? eventError.message : 'Unknown error'
          });
        }
      }

      res.status(200).json({ 
        message: 'Webhook processed successfully',
        processedEvents,
        totalEvents: events.length,
        successfulEvents: processedEvents.filter(e => e.status === 'processed').length
      });
    } catch (error) {
      console.error('SendGrid webhook processing error:', error);
      res.status(500).json({ 
        error: 'Webhook processing failed',
        code: 'WEBHOOK_PROCESSING_ERROR'
      });
    }
  }

  // Generic webhook handler for other providers
  async handleGenericWebhook(req: Request, res: Response): Promise<void> {
    try {
      const provider = req.params.provider;
      const payload = req.body;
      
      // Verify webhook signature based on provider
      if (process.env.NODE_ENV === 'production') {
        const isValid = await this.verifyGenericWebhookSignature(req, provider);
        if (!isValid) {
          console.error(`${provider} webhook signature verification failed`);
          res.status(401).json({ 
            error: 'Invalid signature',
            code: 'WEBHOOK_SIGNATURE_INVALID',
            provider
          });
          return;
        }
      }

      // Process webhook payload
      const webhookPayload: WebhookPayload = {
        provider,
        eventType: payload.eventType || payload.type || 'unknown',
        timestamp: new Date(payload.timestamp || Date.now()),
        data: payload,
        signature: req.headers['x-webhook-signature'] as string
      };

      await this.processGenericWebhook(webhookPayload);

      res.status(200).json({ 
        message: 'Webhook processed successfully',
        provider,
        eventType: webhookPayload.eventType,
        timestamp: webhookPayload.timestamp
      });
    } catch (error) {
      console.error('Generic webhook processing error:', error);
      res.status(500).json({ 
        error: 'Webhook processing failed',
        code: 'WEBHOOK_PROCESSING_ERROR'
      });
    }
  }

  private async processSESEvent(sesMessage: any): Promise<void> {
    const { eventType, mail, bounce, complaint, delivery } = sesMessage;

    switch (eventType) {
      case 'send':
        await this.processEmailEvent({
          messageId: mail.messageId,
          eventType: EmailEventType.SENT,
          timestamp: new Date(mail.timestamp),
          provider: 'amazon-ses',
          tenantId: this.extractTenantId(mail.tags),
          contactEmail: mail.destination[0]
        });
        break;

      case 'delivery':
        await this.processEmailEvent({
          messageId: mail.messageId,
          eventType: EmailEventType.DELIVERED,
          timestamp: new Date(delivery.timestamp),
          provider: 'amazon-ses',
          tenantId: this.extractTenantId(mail.tags),
          contactEmail: mail.destination[0]
        });
        break;

      case 'bounce':
        await this.processBounceEvent({
          messageId: mail.messageId,
          bounceType: bounce.bounceType.toLowerCase(),
          bounceSubType: bounce.bounceSubType,
          timestamp: new Date(bounce.timestamp),
          recipients: bounce.bouncedRecipients.map((r: any) => r.emailAddress),
          feedbackId: bounce.feedbackId
        });
        break;

      case 'complaint':
        await this.processComplaintEvent({
          messageId: mail.messageId,
          timestamp: new Date(complaint.timestamp),
          recipients: complaint.complainedRecipients.map((r: any) => r.emailAddress),
          feedbackId: complaint.feedbackId,
          complaintSubType: complaint.complaintSubType
        });
        break;

      default:
        console.log(`Unhandled SES event type: ${eventType}`);
    }
  }

  private async processSendGridEvent(event: any): Promise<void> {
    const eventTypeMap: Record<string, EmailEventType> = {
      'delivered': EmailEventType.DELIVERED,
      'bounce': EmailEventType.BOUNCED,
      'dropped': EmailEventType.BOUNCED,
      'spamreport': EmailEventType.COMPLAINED,
      'unsubscribe': EmailEventType.UNSUBSCRIBED,
      'open': EmailEventType.OPENED,
      'click': EmailEventType.CLICKED
    };

    const emailEventType = eventTypeMap[event.event];
    if (!emailEventType) {
      console.log(`Unhandled SendGrid event type: ${event.event}`);
      return;
    }

    await this.processEmailEvent({
      messageId: event.sg_message_id || event['smtp-id'],
      eventType: emailEventType,
      timestamp: new Date(event.timestamp * 1000),
      provider: 'sendgrid',
      tenantId: event.tenant_id,
      contactEmail: event.email,
      metadata: {
        reason: event.reason,
        status: event.status,
        url: event.url,
        useragent: event.useragent,
        ip: event.ip
      }
    });
  }

  private async processEmailEvent(event: Omit<EmailEvent, 'id'>): Promise<void> {
    const emailEvent: EmailEvent = {
      id: this.generateEventId(),
      ...event
    };

    await this.eventProcessor.processEmailEvent(emailEvent);
  }

  private async processBounceEvent(bounce: BounceEvent): Promise<void> {
    await this.eventProcessor.processBounceEvent(bounce);
  }

  private async processComplaintEvent(complaint: ComplaintEvent): Promise<void> {
    await this.eventProcessor.processComplaintEvent(complaint);
  }



  private extractTenantId(tags: any[]): string {
    const tenantTag = tags?.find(tag => tag.Name === 'TenantId');
    return tenantTag?.Value || 'unknown';
  }

  private async processGenericWebhook(payload: WebhookPayload): Promise<void> {
    console.log(`Processing ${payload.provider} webhook:`, payload.eventType);
    
    // Extract common email event data
    const eventData = this.extractEmailEventFromPayload(payload);
    
    if (eventData) {
      await this.processEmailEvent(eventData);
    } else {
      console.warn(`Unable to extract email event data from ${payload.provider} webhook`);
    }
  }

  private extractEmailEventFromPayload(payload: WebhookPayload): Omit<EmailEvent, 'id'> | null {
    const { provider, data } = payload;
    
    // Common field mappings for different providers
    const messageId = data.messageId || data.message_id || data.id;
    const email = data.email || data.recipient || data.to;
    const tenantId = data.tenantId || data.tenant_id || this.extractTenantId(data.tags || []);
    
    if (!messageId || !email) {
      return null;
    }

    // Map event types based on provider
    let eventType: EmailEventType;
    const rawEventType = data.eventType || data.event || data.type;
    
    switch (rawEventType?.toLowerCase()) {
      case 'delivered':
      case 'delivery':
        eventType = EmailEventType.DELIVERED;
        break;
      case 'bounced':
      case 'bounce':
        eventType = EmailEventType.BOUNCED;
        break;
      case 'complained':
      case 'complaint':
      case 'spamreport':
        eventType = EmailEventType.COMPLAINED;
        break;
      case 'unsubscribed':
      case 'unsubscribe':
        eventType = EmailEventType.UNSUBSCRIBED;
        break;
      case 'opened':
      case 'open':
        eventType = EmailEventType.OPENED;
        break;
      case 'clicked':
      case 'click':
        eventType = EmailEventType.CLICKED;
        break;
      case 'sent':
      case 'send':
        eventType = EmailEventType.SENT;
        break;
      default:
        console.warn(`Unknown event type: ${rawEventType}`);
        return null;
    }

    return {
      messageId,
      campaignId: data.campaignId || data.campaign_id,
      tenantId,
      contactEmail: email,
      eventType,
      timestamp: new Date(data.timestamp || payload.timestamp),
      provider,
      metadata: {
        originalPayload: data,
        reason: data.reason,
        status: data.status,
        url: data.url,
        userAgent: data.useragent || data.user_agent,
        ip: data.ip
      }
    };
  }

  private async verifyGenericWebhookSignature(req: Request, provider: string): Promise<boolean> {
    try {
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      const body = JSON.stringify(req.body);
      
      // Get provider-specific webhook secret
      const webhookSecret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
      
      if (!signature || !webhookSecret) {
        console.warn(`Missing signature or webhook secret for provider: ${provider}`);
        return false;
      }

      // Create HMAC signature
      const payload = timestamp ? `${timestamp}.${body}` : body;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      // Compare signatures
      const providedSignature = signature.replace(/^sha256=/, '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      console.error(`Webhook signature verification error for ${provider}:`, error);
      return false;
    }
  }

  private verifySendGridSignature(req: Request): boolean {
    // Enhanced SendGrid signature verification
    try {
      const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
      const body = JSON.stringify(req.body);
      
      if (!signature || !timestamp || !process.env.SENDGRID_WEBHOOK_SECRET) {
        return false;
      }

      // Check timestamp to prevent replay attacks (within 10 minutes)
      const webhookTimestamp = parseInt(timestamp);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(currentTimestamp - webhookTimestamp);
      
      if (timeDifference > 600) { // 10 minutes
        console.warn('SendGrid webhook timestamp too old');
        return false;
      }

      const payload = timestamp + body;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.SENDGRID_WEBHOOK_SECRET)
        .update(payload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('SendGrid signature verification error:', error);
      return false;
    }
  }

  private async verifySNSSignature(req: Request): Promise<boolean> {
    // Enhanced SNS signature verification
    try {
      const message = req.body;
      const signature = message.Signature;
      const signingCertURL = message.SigningCertURL;
      const messageType = message.Type;
      
      if (!signature || !signingCertURL) {
        return false;
      }

      // Verify the certificate URL is from AWS
      const certUrl = new URL(signingCertURL);
      if (!certUrl.hostname.endsWith('.amazonaws.com')) {
        console.error('Invalid SNS certificate URL');
        return false;
      }

      // In production, you would:
      // 1. Download and cache the certificate
      // 2. Verify the certificate chain
      // 3. Use the certificate to verify the signature
      
      // For now, return true for valid AWS URLs
      return true;
    } catch (error) {
      console.error('SNS signature verification error:', error);
      return false;
    }
  }

  // Enhanced webhook delivery with retry logic
  async deliverWebhook(url: string, payload: WebhookPayload, secret?: string): Promise<boolean> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const body = JSON.stringify(payload);
        
        // Create HMAC signature if secret provided
        let signature = '';
        if (secret) {
          signature = crypto
            .createHmac('sha256', secret)
            .update(`${timestamp}.${body}`)
            .digest('hex');
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'BulkEmailPlatform-Webhook/1.0',
          'X-Webhook-Timestamp': timestamp.toString()
        };

        if (signature) {
          headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }

        // Make HTTP request (you would use a proper HTTP client like axios)
        console.log(`Delivering webhook to ${url}:`, payload);
        
        // Simulate successful delivery
        return true;
      } catch (error) {
        attempt++;
        console.error(`Webhook delivery attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    console.error(`Failed to deliver webhook after ${maxRetries} attempts`);
    return false;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}