import pool from '../config/database';
import { PoolClient } from 'pg';
import {
  Contact,
  SubscriptionStatus,
  SuppressionType,
  ContactEngagementEvent,
  EngagementEventType
} from './contact.types';

export interface UnsubscribeRequest {
  email: string;
  campaignId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  oneClickToken?: string;
}

export interface UnsubscribeResult {
  success: boolean;
  message: string;
  contactId?: string;
}

export interface SubscriberPreferences {
  contactId: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  preferences: {
    marketing: boolean;
    transactional: boolean;
    newsletters: boolean;
    promotions: boolean;
  };
  frequency: 'daily' | 'weekly' | 'monthly' | 'never';
  categories: string[];
  lastUpdated: Date;
}

export interface ContactDeduplicationResult {
  duplicatesFound: number;
  duplicatesRemoved: number;
  contactsProcessed: number;
  mergedContacts: Array<{
    primaryContactId: string;
    mergedContactIds: string[];
    email: string;
  }>;
}

export interface ContactHistoryEntry {
  id: string;
  contactId: string;
  eventType: EngagementEventType;
  campaignId?: string;
  eventData: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContactEngagementAnalytics {
  contactId: string;
  email: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  engagementScore: number;
  lastEngagement?: Date;
  engagementTrend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction?: string;
}

export class SubscriberManagementService {
  
  /**
   * Handle one-click unsubscribe with token validation
   */
  async handleOneClickUnsubscribe(token: string, ipAddress?: string, userAgent?: string): Promise<UnsubscribeResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Decode and validate token (in real implementation, use JWT or similar)
      const tokenData = this.decodeUnsubscribeToken(token);
      if (!tokenData) {
        return {
          success: false,
          message: 'Invalid or expired unsubscribe token'
        };
      }
      
      const result = await this.processUnsubscribe(client, {
        email: tokenData.email,
        campaignId: tokenData.campaignId,
        reason: 'one_click_unsubscribe',
        ipAddress,
        userAgent,
        oneClickToken: token
      });
      
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Handle manual unsubscribe request
   */
  async handleManualUnsubscribe(request: UnsubscribeRequest): Promise<UnsubscribeResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await this.processUnsubscribe(client, request);
      
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Core unsubscribe processing logic
   */
  private async processUnsubscribe(client: PoolClient, request: UnsubscribeRequest): Promise<UnsubscribeResult> {
    // Find contact by email
    const contactResult = await client.query(
      'SELECT id, tenant_id, email, subscription_status FROM contacts WHERE email = $1',
      [request.email]
    );
    
    if (contactResult.rows.length === 0) {
      return {
        success: false,
        message: 'Email address not found in our system'
      };
    }
    
    const contact = contactResult.rows[0];
    
    if (contact.subscription_status === SubscriptionStatus.UNSUBSCRIBED) {
      return {
        success: true,
        message: 'Email address is already unsubscribed',
        contactId: contact.id
      };
    }
    
    // Update contact status
    await client.query(
      'UPDATE contacts SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [SubscriptionStatus.UNSUBSCRIBED, contact.id]
    );
    
    // Add to suppression list
    await client.query(`
      INSERT INTO suppression_entries (tenant_id, email, suppression_type, reason, source_campaign_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, email, suppression_type) DO NOTHING
    `, [
      contact.tenant_id,
      request.email,
      SuppressionType.UNSUBSCRIBE,
      request.reason || 'user_request',
      request.campaignId
    ]);
    
    // Record engagement event
    await client.query(`
      INSERT INTO contact_engagement_events (contact_id, campaign_id, event_type, event_data, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      contact.id,
      request.campaignId,
      EngagementEventType.UNSUBSCRIBED,
      JSON.stringify({
        reason: request.reason,
        method: request.oneClickToken ? 'one_click' : 'manual',
        token: request.oneClickToken
      }),
      request.ipAddress,
      request.userAgent
    ]);
    
    return {
      success: true,
      message: 'Successfully unsubscribed from all future emails',
      contactId: contact.id
    };
  }
  
  /**
   * Get subscriber preferences for a contact
   */
  async getSubscriberPreferences(tenantId: string, contactId: string): Promise<SubscriberPreferences | null> {
    const result = await pool.query(`
      SELECT c.*, cp.preferences, cp.frequency, cp.categories, cp.updated_at as preferences_updated
      FROM contacts c
      LEFT JOIN contact_preferences cp ON c.id = cp.contact_id
      WHERE c.tenant_id = $1 AND c.id = $2
    `, [tenantId, contactId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      contactId: row.id,
      email: row.email,
      subscriptionStatus: row.subscription_status,
      preferences: row.preferences || {
        marketing: true,
        transactional: true,
        newsletters: true,
        promotions: true
      },
      frequency: row.frequency || 'weekly',
      categories: row.categories || [],
      lastUpdated: row.preferences_updated || row.updated_at
    };
  }
  
  /**
   * Update subscriber preferences
   */
  async updateSubscriberPreferences(
    tenantId: string, 
    contactId: string, 
    preferences: Partial<SubscriberPreferences>
  ): Promise<SubscriberPreferences> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify contact exists and belongs to tenant
      const contactCheck = await client.query(
        'SELECT id FROM contacts WHERE tenant_id = $1 AND id = $2',
        [tenantId, contactId]
      );
      
      if (contactCheck.rows.length === 0) {
        throw new Error('Contact not found');
      }
      
      // Update or insert preferences
      await client.query(`
        INSERT INTO contact_preferences (contact_id, preferences, frequency, categories)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (contact_id) 
        DO UPDATE SET 
          preferences = COALESCE($2, contact_preferences.preferences),
          frequency = COALESCE($3, contact_preferences.frequency),
          categories = COALESCE($4, contact_preferences.categories),
          updated_at = CURRENT_TIMESTAMP
      `, [
        contactId,
        preferences.preferences ? JSON.stringify(preferences.preferences) : null,
        preferences.frequency,
        preferences.categories
      ]);
      
      await client.query('COMMIT');
      
      // Return updated preferences
      const updatedPreferences = await this.getSubscriberPreferences(tenantId, contactId);
      if (!updatedPreferences) {
        throw new Error('Failed to retrieve updated preferences');
      }
      
      return updatedPreferences;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Perform contact deduplication for a tenant
   */
  async deduplicateContacts(tenantId: string): Promise<ContactDeduplicationResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Find duplicate emails
      const duplicatesResult = await client.query(`
        SELECT email, array_agg(id ORDER BY created_at ASC) as contact_ids, COUNT(*) as count
        FROM contacts 
        WHERE tenant_id = $1 
        GROUP BY email 
        HAVING COUNT(*) > 1
      `, [tenantId]);
      
      const duplicatesFound = duplicatesResult.rows.length;
      let duplicatesRemoved = 0;
      const mergedContacts: Array<{
        primaryContactId: string;
        mergedContactIds: string[];
        email: string;
      }> = [];
      
      for (const duplicate of duplicatesResult.rows) {
        const contactIds = duplicate.contact_ids;
        const primaryContactId = contactIds[0]; // Keep the oldest contact
        const duplicateIds = contactIds.slice(1); // Remove the rest
        
        // Merge engagement events to primary contact
        await client.query(`
          UPDATE contact_engagement_events 
          SET contact_id = $1 
          WHERE contact_id = ANY($2)
        `, [primaryContactId, duplicateIds]);
        
        // Merge list memberships to primary contact
        await client.query(`
          INSERT INTO contact_list_memberships (contact_id, list_id, added_at, added_by)
          SELECT $1, list_id, MIN(added_at), 'deduplication'
          FROM contact_list_memberships 
          WHERE contact_id = ANY($2)
          GROUP BY list_id
          ON CONFLICT (contact_id, list_id) DO NOTHING
        `, [primaryContactId, duplicateIds]);
        
        // Delete duplicate contact list memberships
        await client.query(
          'DELETE FROM contact_list_memberships WHERE contact_id = ANY($1)',
          [duplicateIds]
        );
        
        // Delete duplicate contacts
        await client.query(
          'DELETE FROM contacts WHERE id = ANY($1)',
          [duplicateIds]
        );
        
        duplicatesRemoved += duplicateIds.length;
        
        mergedContacts.push({
          primaryContactId,
          mergedContactIds: duplicateIds,
          email: duplicate.email
        });
      }
      
      // Get total contacts processed
      const totalResult = await client.query(
        'SELECT COUNT(*) FROM contacts WHERE tenant_id = $1',
        [tenantId]
      );
      
      await client.query('COMMIT');
      
      return {
        duplicatesFound,
        duplicatesRemoved,
        contactsProcessed: parseInt(totalResult.rows[0].count) + duplicatesRemoved,
        mergedContacts
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get contact history and engagement events
   */
  async getContactHistory(
    tenantId: string, 
    contactId: string, 
    limit = 50, 
    offset = 0
  ): Promise<{ history: ContactHistoryEntry[], total: number }> {
    // Verify contact belongs to tenant
    const contactCheck = await pool.query(
      'SELECT id FROM contacts WHERE tenant_id = $1 AND id = $2',
      [tenantId, contactId]
    );
    
    if (contactCheck.rows.length === 0) {
      throw new Error('Contact not found');
    }
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM contact_engagement_events WHERE contact_id = $1',
      [contactId]
    );
    
    // Get history entries
    const historyResult = await pool.query(`
      SELECT id, contact_id, campaign_id, event_type, event_data, ip_address, user_agent, timestamp
      FROM contact_engagement_events 
      WHERE contact_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `, [contactId, limit, offset]);
    
    const history: ContactHistoryEntry[] = historyResult.rows.map(row => ({
      id: row.id,
      contactId: row.contact_id,
      eventType: row.event_type,
      campaignId: row.campaign_id,
      eventData: row.event_data || {},
      timestamp: row.timestamp,
      ipAddress: row.ip_address,
      userAgent: row.user_agent
    }));
    
    return {
      history,
      total: parseInt(countResult.rows[0].count)
    };
  }
  
  /**
   * Get comprehensive engagement analytics for a contact
   */
  async getContactEngagementAnalytics(tenantId: string, contactId: string): Promise<ContactEngagementAnalytics | null> {
    // Verify contact belongs to tenant
    const contactResult = await pool.query(
      'SELECT id, email FROM contacts WHERE tenant_id = $1 AND id = $2',
      [tenantId, contactId]
    );
    
    if (contactResult.rows.length === 0) {
      return null;
    }
    
    const contact = contactResult.rows[0];
    
    // Get engagement metrics
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as total_sent,
        COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as total_opened,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as total_clicked,
        COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as total_bounced,
        COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as total_complaints,
        MAX(timestamp) as last_engagement
      FROM contact_engagement_events
      WHERE contact_id = $1
    `, [contactId]);
    
    const metrics = metricsResult.rows[0];
    
    // Calculate engagement score and trend
    const engagementScore = this.calculateEngagementScore(metrics);
    const engagementTrend = await this.calculateEngagementTrend(contactId);
    const riskLevel = this.calculateRiskLevel(metrics, engagementScore);
    const recommendedAction = this.getRecommendedAction(riskLevel, engagementScore, metrics);
    
    return {
      contactId,
      email: contact.email,
      totalSent: parseInt(metrics.total_sent) || 0,
      totalDelivered: parseInt(metrics.total_delivered) || 0,
      totalOpened: parseInt(metrics.total_opened) || 0,
      totalClicked: parseInt(metrics.total_clicked) || 0,
      totalBounced: parseInt(metrics.total_bounced) || 0,
      totalComplaints: parseInt(metrics.total_complaints) || 0,
      engagementScore,
      lastEngagement: metrics.last_engagement,
      engagementTrend,
      riskLevel,
      recommendedAction
    };
  }
  
  /**
   * Generate one-click unsubscribe token
   */
  generateUnsubscribeToken(email: string, campaignId?: string): string {
    // In a real implementation, use JWT with expiration
    const tokenData = {
      email,
      campaignId,
      timestamp: Date.now()
    };
    
    // Simple base64 encoding for demo (use proper JWT in production)
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }
  
  /**
   * Decode unsubscribe token
   */
  private decodeUnsubscribeToken(token: string): { email: string; campaignId?: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const tokenData = JSON.parse(decoded);
      
      // Check if token is expired (24 hours)
      if (Date.now() - tokenData.timestamp > 24 * 60 * 60 * 1000) {
        return null;
      }
      
      return {
        email: tokenData.email,
        campaignId: tokenData.campaignId
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Calculate engagement score (0-100)
   */
  private calculateEngagementScore(metrics: any): number {
    const sent = parseInt(metrics.total_sent) || 0;
    const opened = parseInt(metrics.total_opened) || 0;
    const clicked = parseInt(metrics.total_clicked) || 0;
    const bounced = parseInt(metrics.total_bounced) || 0;
    const complaints = parseInt(metrics.total_complaints) || 0;
    
    if (sent === 0) return 0;
    
    const openRate = opened / sent;
    const clickRate = clicked / sent;
    const bounceRate = bounced / sent;
    const complaintRate = complaints / sent;
    
    // Weighted engagement score
    let score = (openRate * 40) + (clickRate * 60) - (bounceRate * 30) - (complaintRate * 50);
    return Math.max(0, Math.min(100, Math.round(score * 100)));
  }
  
  /**
   * Calculate engagement trend over time
   */
  private async calculateEngagementTrend(contactId: string): Promise<'increasing' | 'decreasing' | 'stable'> {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('week', timestamp) as week,
        COUNT(CASE WHEN event_type IN ('opened', 'clicked') THEN 1 END) as positive_events,
        COUNT(*) as total_events
      FROM contact_engagement_events
      WHERE contact_id = $1 AND timestamp >= NOW() - INTERVAL '8 weeks'
      GROUP BY week
      ORDER BY week DESC
      LIMIT 4
    `, [contactId]);
    
    if (result.rows.length < 2) {
      return 'stable';
    }
    
    const weeks = result.rows.map(row => ({
      week: row.week,
      engagementRate: parseInt(row.positive_events) / parseInt(row.total_events)
    }));
    
    const recentRate = weeks[0].engagementRate;
    const olderRate = weeks[weeks.length - 1].engagementRate;
    
    const difference = recentRate - olderRate;
    
    if (difference > 0.1) return 'increasing';
    if (difference < -0.1) return 'decreasing';
    return 'stable';
  }
  
  /**
   * Calculate risk level based on engagement metrics
   */
  private calculateRiskLevel(metrics: any, engagementScore: number): 'low' | 'medium' | 'high' {
    const bounceRate = parseInt(metrics.total_bounced) / (parseInt(metrics.total_sent) || 1);
    const complaintRate = parseInt(metrics.total_complaints) / (parseInt(metrics.total_sent) || 1);
    
    if (bounceRate > 0.1 || complaintRate > 0.01 || engagementScore < 20) {
      return 'high';
    }
    
    if (bounceRate > 0.05 || complaintRate > 0.005 || engagementScore < 50) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Get recommended action based on risk and engagement
   */
  private getRecommendedAction(riskLevel: string, engagementScore: number, metrics: any): string {
    if (riskLevel === 'high') {
      return 'Consider removing from active campaigns or reducing send frequency';
    }
    
    if (riskLevel === 'medium') {
      return 'Monitor engagement closely and consider segmentation';
    }
    
    if (engagementScore > 80) {
      return 'Highly engaged subscriber - consider VIP treatment';
    }
    
    return 'Continue regular engagement';
  }
}