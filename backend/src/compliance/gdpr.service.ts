import pool from '../config/database';
import { EncryptionService } from '../security/encryption.service';
import { AuditLogService } from './audit-log.service';

export interface DataExportRequest {
  userId: string;
  tenantId: string;
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface DataDeletionRequest {
  userId: string;
  tenantId: string;
  requestedAt: Date;
  scheduledAt: Date;
  completedAt?: Date;
  status: 'pending' | 'scheduled' | 'completed' | 'failed';
  retentionPeriod: number; // days
}

export interface ConsentRecord {
  userId: string;
  tenantId: string;
  consentType: 'marketing' | 'analytics' | 'functional' | 'necessary';
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  ipAddress: string;
  userAgent: string;
  version: string;
}

export class GDPRService {
  private encryptionService: EncryptionService;
  private auditLogService: AuditLogService;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Request data export (Right to Data Portability - Article 20)
   */
  async requestDataExport(userId: string, tenantId: string, requestedBy: string): Promise<string> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create export request
      const requestId = this.encryptionService.generateSecureToken();
      
      await client.query(`
        INSERT INTO gdpr_data_export_requests (
          id, user_id, tenant_id, requested_by, status, created_at
        ) VALUES ($1, $2, $3, $4, 'pending', NOW())
      `, [requestId, userId, tenantId, requestedBy]);

      // Log the request
      await this.auditLogService.log({
        tenantId,
        userId: requestedBy,
        action: 'GDPR_DATA_EXPORT_REQUESTED',
        resourceType: 'user',
        resourceId: userId,
        details: { requestId },
        ipAddress: '',
        userAgent: ''
      });

      await client.query('COMMIT');

      // Process export asynchronously
      this.processDataExport(requestId).catch(console.error);

      return requestId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process data export request
   */
  private async processDataExport(requestId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Update status to processing
      await client.query(`
        UPDATE gdpr_data_export_requests 
        SET status = 'processing', processing_started_at = NOW()
        WHERE id = $1
      `, [requestId]);

      // Get request details
      const requestResult = await client.query(`
        SELECT user_id, tenant_id FROM gdpr_data_export_requests WHERE id = $1
      `, [requestId]);

      if (requestResult.rows.length === 0) {
        throw new Error('Export request not found');
      }

      const { user_id: userId, tenant_id: tenantId } = requestResult.rows[0];

      // Collect all user data
      const userData = await this.collectUserData(userId, tenantId);

      // Generate export file (JSON format)
      const exportData = {
        exportedAt: new Date().toISOString(),
        userId,
        tenantId,
        data: userData
      };

      // In production, save to secure file storage (S3, etc.)
      const exportJson = JSON.stringify(exportData, null, 2);
      const downloadUrl = await this.saveExportFile(requestId, exportJson);

      // Update request with completion
      await client.query(`
        UPDATE gdpr_data_export_requests 
        SET status = 'completed', completed_at = NOW(), download_url = $2
        WHERE id = $1
      `, [requestId, downloadUrl]);

      // Log completion
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'GDPR_DATA_EXPORT_COMPLETED',
        resourceType: 'user',
        resourceId: userId,
        details: { requestId, downloadUrl },
        ipAddress: '',
        userAgent: ''
      });

    } catch (error) {
      // Update status to failed
      await client.query(`
        UPDATE gdpr_data_export_requests 
        SET status = 'failed', error_message = $2
        WHERE id = $1
      `, [requestId, error instanceof Error ? error.message : 'Unknown error']);

      console.error('Data export failed:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Request data deletion (Right to Erasure - Article 17)
   */
  async requestDataDeletion(
    userId: string, 
    tenantId: string, 
    requestedBy: string,
    retentionPeriod: number = 30
  ): Promise<string> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const requestId = this.encryptionService.generateSecureToken();
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + retentionPeriod);

      // Create deletion request
      await client.query(`
        INSERT INTO gdpr_data_deletion_requests (
          id, user_id, tenant_id, requested_by, retention_period_days,
          scheduled_at, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
      `, [requestId, userId, tenantId, requestedBy, retentionPeriod, scheduledAt]);

      // Log the request
      await this.auditLogService.log({
        tenantId,
        userId: requestedBy,
        action: 'GDPR_DATA_DELETION_REQUESTED',
        resourceType: 'user',
        resourceId: userId,
        details: { requestId, scheduledAt, retentionPeriod },
        ipAddress: '',
        userAgent: ''
      });

      await client.query('COMMIT');

      return requestId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process scheduled data deletions
   */
  async processScheduledDeletions(): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Get scheduled deletions that are due
      const result = await client.query(`
        SELECT id, user_id, tenant_id 
        FROM gdpr_data_deletion_requests 
        WHERE status = 'scheduled' AND scheduled_at <= NOW()
      `);

      for (const request of result.rows) {
        await this.executeDataDeletion(request.id, request.user_id, request.tenant_id);
      }
    } catch (error) {
      console.error('Error processing scheduled deletions:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Execute data deletion
   */
  private async executeDataDeletion(requestId: string, userId: string, tenantId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete user data from all tables
      const deletionQueries = [
        'DELETE FROM email_events WHERE contact_id IN (SELECT id FROM contacts WHERE tenant_id = $1 AND user_id = $2)',
        'DELETE FROM email_jobs WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM campaigns WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM templates WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM contacts WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM contact_lists WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM api_keys WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM subscriptions WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM billing_transactions WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM scheduled_emails WHERE tenant_id = $1 AND user_id = $2',
        'DELETE FROM branding_settings WHERE tenant_id = $1 AND user_id = $2',
        // Keep audit logs for compliance but anonymize them
        'UPDATE audit_logs SET user_id = NULL, details = jsonb_set(details, \'{anonymized}\', \'true\') WHERE tenant_id = $1 AND user_id = $2',
        // Finally delete the user
        'DELETE FROM users WHERE id = $2 AND tenant_id = $1'
      ];

      for (const query of deletionQueries) {
        await client.query(query, [tenantId, userId]);
      }

      // Update deletion request status
      await client.query(`
        UPDATE gdpr_data_deletion_requests 
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [requestId]);

      // Log completion (anonymized)
      await this.auditLogService.log({
        tenantId,
        userId: null, // Anonymized
        action: 'GDPR_DATA_DELETION_COMPLETED',
        resourceType: 'user',
        resourceId: 'anonymized',
        details: { requestId, anonymized: true },
        ipAddress: '',
        userAgent: ''
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Update deletion request status to failed
      await client.query(`
        UPDATE gdpr_data_deletion_requests 
        SET status = 'failed', error_message = $2
        WHERE id = $1
      `, [requestId, error instanceof Error ? error.message : 'Unknown error']);

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record consent (Article 7)
   */
  async recordConsent(consent: Omit<ConsentRecord, 'version'>): Promise<void> {
    const client = await pool.connect();
    
    try {
      const version = '1.0'; // Consent version
      
      await client.query(`
        INSERT INTO gdpr_consent_records (
          user_id, tenant_id, consent_type, granted, granted_at, revoked_at,
          ip_address, user_agent, version, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        consent.userId,
        consent.tenantId,
        consent.consentType,
        consent.granted,
        consent.granted ? new Date() : null,
        consent.granted ? null : new Date(),
        consent.ipAddress,
        consent.userAgent,
        version
      ]);

      // Log consent action
      await this.auditLogService.log({
        tenantId: consent.tenantId,
        userId: consent.userId,
        action: consent.granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        resourceType: 'consent',
        resourceId: consent.consentType,
        details: { consentType: consent.consentType, version },
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get user consent status
   */
  async getConsentStatus(userId: string, tenantId: string): Promise<ConsentRecord[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT DISTINCT ON (consent_type) 
          user_id, tenant_id, consent_type, granted, granted_at, revoked_at,
          ip_address, user_agent, version
        FROM gdpr_consent_records 
        WHERE user_id = $1 AND tenant_id = $2
        ORDER BY consent_type, created_at DESC
      `, [userId, tenantId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Collect all user data for export
   */
  private async collectUserData(userId: string, tenantId: string): Promise<any> {
    const client = await pool.connect();
    
    try {
      const userData: any = {};

      // User profile
      const userResult = await client.query(`
        SELECT id, email, first_name, last_name, phone, created_at, last_login_at
        FROM users WHERE id = $1 AND tenant_id = $2
      `, [userId, tenantId]);
      userData.profile = userResult.rows[0];

      // Contacts
      const contactsResult = await client.query(`
        SELECT * FROM contacts WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
      userData.contacts = contactsResult.rows;

      // Contact lists
      const listsResult = await client.query(`
        SELECT * FROM contact_lists WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
      userData.contactLists = listsResult.rows;

      // Templates
      const templatesResult = await client.query(`
        SELECT * FROM templates WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
      userData.templates = templatesResult.rows;

      // Campaigns
      const campaignsResult = await client.query(`
        SELECT * FROM campaigns WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
      userData.campaigns = campaignsResult.rows;

      // Email events (last 90 days for performance)
      const eventsResult = await client.query(`
        SELECT ee.* FROM email_events ee
        JOIN contacts c ON ee.contact_id = c.id
        WHERE c.tenant_id = $1 AND c.user_id = $2
        AND ee.created_at >= NOW() - INTERVAL '90 days'
      `, [tenantId, userId]);
      userData.emailEvents = eventsResult.rows;

      // Subscription data
      const subscriptionResult = await client.query(`
        SELECT * FROM subscriptions WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
      userData.subscription = subscriptionResult.rows[0];

      // Billing transactions
      const billingResult = await client.query(`
        SELECT * FROM billing_transactions WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
      userData.billingTransactions = billingResult.rows;

      // Consent records
      const consentResult = await client.query(`
        SELECT * FROM gdpr_consent_records WHERE user_id = $1 AND tenant_id = $2
      `, [userId, tenantId]);
      userData.consentRecords = consentResult.rows;

      return userData;
    } finally {
      client.release();
    }
  }

  /**
   * Save export file (mock implementation - use S3 in production)
   */
  private async saveExportFile(requestId: string, content: string): Promise<string> {
    // In production, save to secure cloud storage
    // For now, return a mock URL
    return `https://secure-exports.bulk-email-platform.com/exports/${requestId}.json`;
  }

  /**
   * Check if user has valid consent for processing
   */
  async hasValidConsent(userId: string, tenantId: string, consentType: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT granted FROM gdpr_consent_records 
        WHERE user_id = $1 AND tenant_id = $2 AND consent_type = $3
        ORDER BY created_at DESC LIMIT 1
      `, [userId, tenantId, consentType]);

      return result.rows.length > 0 && result.rows[0].granted;
    } finally {
      client.release();
    }
  }
}