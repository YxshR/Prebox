import { EmailEvent, EmailEventType, EmailStatus } from './types';
import { CampaignMetrics } from '../shared/types';

export interface DeliveryTrackingService {
  recordEmailEvent(event: EmailEvent): Promise<void>;
  getEmailStatus(messageId: string): Promise<EmailStatus | null>;
  getCampaignDeliveryStats(campaignId: string): Promise<CampaignMetrics>;
  getContactEngagement(email: string, tenantId: string): Promise<ContactEngagement>;
}

export interface ContactEngagement {
  email: string;
  totalEmailsReceived: number;
  totalOpens: number;
  totalClicks: number;
  lastOpenedAt?: Date;
  lastClickedAt?: Date;
  subscriptionStatus: 'subscribed' | 'unsubscribed' | 'bounced' | 'complained';
}

export class EmailDeliveryTrackingService implements DeliveryTrackingService {
  private emailEvents: Map<string, EmailEvent[]> = new Map(); // messageId -> events
  private campaignMetrics: Map<string, CampaignMetrics> = new Map(); // campaignId -> metrics
  private contactEngagement: Map<string, ContactEngagement> = new Map(); // email -> engagement

  async recordEmailEvent(event: EmailEvent): Promise<void> {
    // Store the event
    const existingEvents = this.emailEvents.get(event.messageId) || [];
    existingEvents.push(event);
    this.emailEvents.set(event.messageId, existingEvents);

    // Update campaign metrics if this event is part of a campaign
    if (event.campaignId) {
      await this.updateCampaignMetrics(event.campaignId, event);
    }

    // Update contact engagement
    await this.updateContactEngagement(event);

    console.log(`📊 Recorded email event: ${event.eventType} for ${event.contactEmail} (${event.messageId})`);
  }

  async getEmailStatus(messageId: string): Promise<EmailStatus | null> {
    const events = this.emailEvents.get(messageId);
    
    if (!events || events.length === 0) {
      return null;
    }

    // Return the most recent status based on event priority
    const statusPriority: Record<EmailEventType, number> = {
      [EmailEventType.SENT]: 1,
      [EmailEventType.DELIVERED]: 2,
      [EmailEventType.OPENED]: 3,
      [EmailEventType.CLICKED]: 4,
      [EmailEventType.BOUNCED]: 5,
      [EmailEventType.COMPLAINED]: 6,
      [EmailEventType.UNSUBSCRIBED]: 7
    };

    const sortedEvents = events.sort((a, b) => {
      const priorityDiff = statusPriority[b.eventType] - statusPriority[a.eventType];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    const latestEvent = sortedEvents[0];
    
    // Map event types to email status
    const eventToStatusMap: Record<EmailEventType, EmailStatus> = {
      [EmailEventType.SENT]: EmailStatus.SENT,
      [EmailEventType.DELIVERED]: EmailStatus.DELIVERED,
      [EmailEventType.OPENED]: EmailStatus.DELIVERED, // Opened implies delivered
      [EmailEventType.CLICKED]: EmailStatus.DELIVERED, // Clicked implies delivered
      [EmailEventType.BOUNCED]: EmailStatus.BOUNCED,
      [EmailEventType.COMPLAINED]: EmailStatus.COMPLAINED,
      [EmailEventType.UNSUBSCRIBED]: EmailStatus.UNSUBSCRIBED
    };

    return eventToStatusMap[latestEvent.eventType];
  }

  async getCampaignDeliveryStats(campaignId: string): Promise<CampaignMetrics> {
    const metrics = this.campaignMetrics.get(campaignId);
    
    if (!metrics) {
      return {
        totalRecipients: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        complained: 0
      };
    }

    return { ...metrics };
  }

  async getContactEngagement(email: string, tenantId: string): Promise<ContactEngagement> {
    const engagement = this.contactEngagement.get(`${tenantId}:${email}`);
    
    if (!engagement) {
      return {
        email,
        totalEmailsReceived: 0,
        totalOpens: 0,
        totalClicks: 0,
        subscriptionStatus: 'subscribed'
      };
    }

    return { ...engagement };
  }

  private async updateCampaignMetrics(campaignId: string, event: EmailEvent): Promise<void> {
    let metrics = this.campaignMetrics.get(campaignId);
    
    if (!metrics) {
      metrics = {
        totalRecipients: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        complained: 0
      };
    }

    // Update metrics based on event type
    switch (event.eventType) {
      case EmailEventType.DELIVERED:
        metrics.delivered++;
        break;
      case EmailEventType.BOUNCED:
        metrics.bounced++;
        break;
      case EmailEventType.OPENED:
        metrics.opened++;
        break;
      case EmailEventType.CLICKED:
        metrics.clicked++;
        break;
      case EmailEventType.UNSUBSCRIBED:
        metrics.unsubscribed++;
        break;
      case EmailEventType.COMPLAINED:
        metrics.complained++;
        break;
    }

    this.campaignMetrics.set(campaignId, metrics);
  }

  private async updateContactEngagement(event: EmailEvent): Promise<void> {
    const key = `${event.tenantId}:${event.contactEmail}`;
    let engagement = this.contactEngagement.get(key);
    
    if (!engagement) {
      engagement = {
        email: event.contactEmail,
        totalEmailsReceived: 0,
        totalOpens: 0,
        totalClicks: 0,
        subscriptionStatus: 'subscribed'
      };
    }

    // Update engagement based on event type
    switch (event.eventType) {
      case EmailEventType.DELIVERED:
        engagement.totalEmailsReceived++;
        break;
      case EmailEventType.OPENED:
        engagement.totalOpens++;
        engagement.lastOpenedAt = event.timestamp;
        break;
      case EmailEventType.CLICKED:
        engagement.totalClicks++;
        engagement.lastClickedAt = event.timestamp;
        break;
      case EmailEventType.BOUNCED:
        engagement.subscriptionStatus = 'bounced';
        break;
      case EmailEventType.COMPLAINED:
        engagement.subscriptionStatus = 'complained';
        break;
      case EmailEventType.UNSUBSCRIBED:
        engagement.subscriptionStatus = 'unsubscribed';
        break;
    }

    this.contactEngagement.set(key, engagement);
  }

  // Helper method to get all events for a campaign
  async getCampaignEvents(campaignId: string): Promise<EmailEvent[]> {
    const allEvents: EmailEvent[] = [];
    
    for (const events of this.emailEvents.values()) {
      const campaignEvents = events.filter(event => event.campaignId === campaignId);
      allEvents.push(...campaignEvents);
    }

    return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Helper method to get events for a specific email address
  async getContactEvents(email: string, tenantId: string): Promise<EmailEvent[]> {
    const allEvents: EmailEvent[] = [];
    
    for (const events of this.emailEvents.values()) {
      const contactEvents = events.filter(event => 
        event.contactEmail === email && event.tenantId === tenantId
      );
      allEvents.push(...contactEvents);
    }

    return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Method to simulate webhook events (for testing)
  async simulateWebhookEvent(
    messageId: string,
    eventType: EmailEventType,
    contactEmail: string,
    tenantId: string,
    campaignId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: EmailEvent = {
      id: this.generateEventId(),
      messageId,
      campaignId,
      tenantId,
      contactEmail,
      eventType,
      timestamp: new Date(),
      provider: 'simulated',
      metadata
    };

    await this.recordEmailEvent(event);
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}