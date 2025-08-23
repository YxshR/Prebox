/**
 * Subscriber Management Integration Examples
 * 
 * This file demonstrates how to use the subscriber management features
 * in real-world scenarios for the bulk email platform.
 */

import { SubscriberManagementService } from './subscriber-management.service';
import { ContactService } from './contact.service';
import { SubscriptionStatus, SuppressionType } from './contact.types';

const subscriberService = new SubscriberManagementService();
const contactService = new ContactService();

/**
 * Example 1: Setting up one-click unsubscribe in email campaigns
 */
export async function setupOneClickUnsubscribe(email: string, campaignId: string) {
  // Generate secure unsubscribe token
  const token = subscriberService.generateUnsubscribeToken(email, campaignId);
  
  // Create unsubscribe URL for email
  const unsubscribeUrl = `https://yourdomain.com/api/contacts/unsubscribe/${token}`;
  
  // Email headers for RFC compliance
  const emailHeaders = {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  };
  
  // Email footer HTML
  const footerHtml = `
    <div style="margin-top: 20px; padding: 10px; border-top: 1px solid #ccc; font-size: 12px; color: #666;">
      <p>
        If you no longer wish to receive these emails, you can 
        <a href="${unsubscribeUrl}" style="color: #007cba;">unsubscribe here</a>.
      </p>
    </div>
  `;
  
  return {
    token,
    unsubscribeUrl,
    emailHeaders,
    footerHtml
  };
}

/**
 * Example 2: Processing webhook events for engagement tracking
 */
export async function processEngagementWebhook(webhookData: any) {
  const { email, eventType, campaignId, timestamp, ipAddress, userAgent } = webhookData;
  
  // Find contact by email
  const contacts = await contactService.searchContacts(
    webhookData.tenantId, 
    { email }, 
    1, 
    0
  );
  
  if (contacts.contacts.length === 0) {
    console.log(`Contact not found for email: ${email}`);
    return;
  }
  
  const contact = contacts.contacts[0];
  
  // Record engagement event
  await contactService.recordEngagementEvent({
    contactId: contact.id,
    campaignId,
    eventType,
    eventData: webhookData,
    ipAddress,
    userAgent
  });
  
  // Handle specific event types
  switch (eventType) {
    case 'bounced':
      await contactService.addToSuppressionList(
        webhookData.tenantId,
        email,
        SuppressionType.BOUNCE,
        'Hard bounce from ESP',
        campaignId
      );
      break;
      
    case 'complained':
      await contactService.addToSuppressionList(
        webhookData.tenantId,
        email,
        SuppressionType.COMPLAINT,
        'Spam complaint from recipient',
        campaignId
      );
      break;
      
    case 'unsubscribed':
      // This would be handled by the unsubscribe endpoint
      // but we can also process it here for webhook-based unsubscribes
      await subscriberService.handleManualUnsubscribe({
        email,
        campaignId,
        reason: 'webhook_unsubscribe',
        ipAddress,
        userAgent
      });
      break;
  }
  
  console.log(`Processed ${eventType} event for ${email}`);
}

/**
 * Example 3: Building a preference center interface
 */
export async function buildPreferenceCenter(tenantId: string, contactId: string) {
  // Get current preferences
  const preferences = await subscriberService.getSubscriberPreferences(tenantId, contactId);
  
  if (!preferences) {
    throw new Error('Contact not found');
  }
  
  // Preference center data structure
  const preferenceCenterData = {
    contact: {
      email: preferences.email,
      subscriptionStatus: preferences.subscriptionStatus
    },
    preferences: {
      emailTypes: [
        {
          key: 'marketing',
          label: 'Marketing Emails',
          description: 'Product updates, promotions, and special offers',
          enabled: preferences.preferences.marketing
        },
        {
          key: 'newsletters',
          label: 'Newsletters',
          description: 'Weekly industry insights and company news',
          enabled: preferences.preferences.newsletters
        },
        {
          key: 'promotions',
          label: 'Promotional Offers',
          description: 'Exclusive deals and discount codes',
          enabled: preferences.preferences.promotions
        },
        {
          key: 'transactional',
          label: 'Transactional Emails',
          description: 'Order confirmations, receipts, and account updates',
          enabled: preferences.preferences.transactional,
          required: true // Cannot be disabled
        }
      ],
      frequency: {
        current: preferences.frequency,
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'never', label: 'Never' }
        ]
      },
      categories: {
        available: ['tech', 'business', 'marketing', 'design', 'development'],
        selected: preferences.categories
      }
    },
    lastUpdated: preferences.lastUpdated
  };
  
  return preferenceCenterData;
}

/**
 * Example 4: Automated contact cleanup and deduplication
 */
export async function performContactMaintenance(tenantId: string) {
  console.log('Starting contact maintenance for tenant:', tenantId);
  
  // Step 1: Deduplicate contacts
  const deduplicationResult = await subscriberService.deduplicateContacts(tenantId);
  console.log(`Deduplication completed:`, {
    duplicatesFound: deduplicationResult.duplicatesFound,
    duplicatesRemoved: deduplicationResult.duplicatesRemoved,
    contactsProcessed: deduplicationResult.contactsProcessed
  });
  
  // Step 2: Identify high-risk contacts
  const contacts = await contactService.searchContacts(tenantId, {}, 1000, 0);
  const highRiskContacts = [];
  
  for (const contact of contacts.contacts) {
    const analytics = await subscriberService.getContactEngagementAnalytics(tenantId, contact.id);
    
    if (analytics && analytics.riskLevel === 'high') {
      highRiskContacts.push({
        contact,
        analytics,
        recommendation: analytics.recommendedAction
      });
    }
  }
  
  console.log(`Found ${highRiskContacts.length} high-risk contacts`);
  
  // Step 3: Generate maintenance report
  const maintenanceReport = {
    timestamp: new Date(),
    tenantId,
    deduplication: deduplicationResult,
    highRiskContacts: highRiskContacts.length,
    recommendations: highRiskContacts.map(item => ({
      email: item.contact.email,
      riskLevel: item.analytics.riskLevel,
      engagementScore: item.analytics.engagementScore,
      recommendation: item.recommendation
    }))
  };
  
  return maintenanceReport;
}

/**
 * Example 5: Implementing subscriber re-engagement campaign
 */
export async function identifyReengagementCandidates(tenantId: string) {
  const contacts = await contactService.searchContacts(
    tenantId, 
    { subscriptionStatus: SubscriptionStatus.SUBSCRIBED }, 
    1000, 
    0
  );
  
  const reengagementCandidates = [];
  
  for (const contact of contacts.contacts) {
    const analytics = await subscriberService.getContactEngagementAnalytics(tenantId, contact.id);
    
    if (analytics) {
      // Identify contacts with declining engagement
      const isCandidate = (
        analytics.engagementScore < 30 && 
        analytics.engagementTrend === 'decreasing' &&
        analytics.totalSent > 5 && // Has received at least 5 emails
        analytics.lastEngagement && 
        (Date.now() - analytics.lastEngagement.getTime()) > (30 * 24 * 60 * 60 * 1000) // No engagement in 30 days
      );
      
      if (isCandidate) {
        reengagementCandidates.push({
          contactId: contact.id,
          email: contact.email,
          engagementScore: analytics.engagementScore,
          daysSinceLastEngagement: Math.floor(
            (Date.now() - analytics.lastEngagement!.getTime()) / (24 * 60 * 60 * 1000)
          ),
          totalSent: analytics.totalSent,
          totalOpened: analytics.totalOpened,
          openRate: analytics.totalSent > 0 ? (analytics.totalOpened / analytics.totalSent) * 100 : 0
        });
      }
    }
  }
  
  // Sort by engagement score (lowest first)
  reengagementCandidates.sort((a, b) => a.engagementScore - b.engagementScore);
  
  return {
    totalCandidates: reengagementCandidates.length,
    candidates: reengagementCandidates,
    segmentationSuggestions: {
      highPriority: reengagementCandidates.filter(c => c.engagementScore < 10).length,
      mediumPriority: reengagementCandidates.filter(c => c.engagementScore >= 10 && c.engagementScore < 20).length,
      lowPriority: reengagementCandidates.filter(c => c.engagementScore >= 20).length
    }
  };
}

/**
 * Example 6: Compliance audit and reporting
 */
export async function generateComplianceReport(tenantId: string) {
  // Get suppression list statistics
  const suppressionList = await contactService.getSuppressionList(tenantId);
  const suppressionStats = {
    total: suppressionList.length,
    byType: {
      unsubscribe: suppressionList.filter(s => s.suppressionType === 'unsubscribe').length,
      bounce: suppressionList.filter(s => s.suppressionType === 'bounce').length,
      complaint: suppressionList.filter(s => s.suppressionType === 'complaint').length,
      manual: suppressionList.filter(s => s.suppressionType === 'manual').length
    }
  };
  
  // Get contact statistics
  const allContacts = await contactService.searchContacts(tenantId, {}, 10000, 0);
  const contactStats = {
    total: allContacts.total,
    byStatus: {
      subscribed: allContacts.contacts.filter(c => c.subscriptionStatus === SubscriptionStatus.SUBSCRIBED).length,
      unsubscribed: allContacts.contacts.filter(c => c.subscriptionStatus === SubscriptionStatus.UNSUBSCRIBED).length,
      bounced: allContacts.contacts.filter(c => c.subscriptionStatus === SubscriptionStatus.BOUNCED).length,
      complained: allContacts.contacts.filter(c => c.subscriptionStatus === SubscriptionStatus.COMPLAINED).length
    }
  };
  
  // Calculate compliance metrics
  const unsubscribeRate = (contactStats.byStatus.unsubscribed / contactStats.total) * 100;
  const bounceRate = (contactStats.byStatus.bounced / contactStats.total) * 100;
  const complaintRate = (contactStats.byStatus.complained / contactStats.total) * 100;
  
  const complianceReport = {
    timestamp: new Date(),
    tenantId,
    contactStatistics: contactStats,
    suppressionStatistics: suppressionStats,
    complianceMetrics: {
      unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      complaintRate: Math.round(complaintRate * 100) / 100
    },
    complianceStatus: {
      unsubscribeCompliance: unsubscribeRate < 5, // Good if under 5%
      bounceCompliance: bounceRate < 2, // Good if under 2%
      complaintCompliance: complaintRate < 0.1 // Good if under 0.1%
    },
    recommendations: [] as string[]
  };
  
  // Add recommendations based on metrics
  if (unsubscribeRate > 5) {
    complianceReport.recommendations.push('High unsubscribe rate detected. Review email content and frequency.');
  }
  
  if (bounceRate > 2) {
    complianceReport.recommendations.push('High bounce rate detected. Implement list hygiene practices.');
  }
  
  if (complaintRate > 0.1) {
    complianceReport.recommendations.push('High complaint rate detected. Review sender reputation and content quality.');
  }
  
  return complianceReport;
}

// Export all examples for use in other modules
export const SubscriberManagementExamples = {
  setupOneClickUnsubscribe,
  processEngagementWebhook,
  buildPreferenceCenter,
  performContactMaintenance,
  identifyReengagementCandidates,
  generateComplianceReport
};