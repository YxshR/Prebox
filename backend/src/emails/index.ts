export { EmailService } from './email.service';
export { EmailQueue } from './queue/email.queue';
export { WebhookHandler } from './webhook/webhook.handler';
export { EventProcessor } from './webhook/event.processor';
export { EmailController } from './email.controller';
export { SESProvider } from './providers/ses.provider';
export { SendGridProvider } from './providers/sendgrid.provider';

// Scheduled Email System
export { ScheduledEmailService } from './scheduled-email.service';
export { ScheduledEmailController } from './scheduled-email.controller';
export { scheduledEmailCron } from './scheduled-email.cron';

// Deliverability Monitoring System
export { DeliverabilityMonitoringService } from './deliverability-monitoring.service';
export { DeliverabilityController } from './deliverability.controller';
export { createDeliverabilityRoutes } from './deliverability.routes';

export * from './types';
export * from './scheduled-email.types';

import createEmailRoutes from './email.routes';
import scheduledEmailRoutes from './scheduled-email.routes';
export { createEmailRoutes, scheduledEmailRoutes };