import pool from '../config/database';
import {
  Contact,
  ContactList,
  ContactImportJob,
  SuppressionEntry,
  ContactEngagementEvent,
  CreateContactRequest,
  UpdateContactRequest,
  CreateContactListRequest,
  UpdateContactListRequest,
  ImportContactsRequest,
  ContactImportResult,
  ContactSearchFilters,
  ContactEngagementSummary,
  SubscriptionStatus,
  ContactSource,
  EngagementEventType,
  ImportJobStatus,
  SuppressionType,
  CSVImportMapping,
  ContactExportRequest,
  ContactExportResult,
  ImportError
} from './contact.types';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { PoolClient } from 'pg';

export class ContactService {
  // Contact CRUD Operations
  async createContact(tenantId: string, contactData: CreateContactRequest): Promise<Contact> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if contact already exists
      const existingContact = await client.query(
        'SELECT id FROM contacts WHERE tenant_id = $1 AND email = $2',
        [tenantId, contactData.email]
      );

      if (existingContact.rows.length > 0) {
        throw new Error('Contact with this email already exists');
      }

      // Create contact
      const contactResult = await client.query(`
        INSERT INTO contacts (tenant_id, email, first_name, last_name, phone, custom_fields, tags, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        tenantId,
        contactData.email,
        contactData.firstName,
        contactData.lastName,
        contactData.phone,
        JSON.stringify(contactData.customFields || {}),
        contactData.tags || [],
        ContactSource.MANUAL
      ]);

      const contact = this.mapRowToContact(contactResult.rows[0]);

      // Add to lists if specified
      if (contactData.listIds && contactData.listIds.length > 0) {
        await this.addContactToLists(client, contact.id, contactData.listIds);
      }

      await client.query('COMMIT');
      return contact;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getContact(tenantId: string, contactId: string): Promise<Contact | null> {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE tenant_id = $1 AND id = $2',
      [tenantId, contactId]
    );

    return result.rows.length > 0 ? this.mapRowToContact(result.rows[0]) : null;
  }

  async updateContact(tenantId: string, contactId: string, updates: UpdateContactRequest): Promise<Contact> {
    const setParts: string[] = [];
    const values: any[] = [tenantId, contactId];
    let paramIndex = 3;

    if (updates.firstName !== undefined) {
      setParts.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName);
    }

    if (updates.lastName !== undefined) {
      setParts.push(`last_name = $${paramIndex++}`);
      values.push(updates.lastName);
    }

    if (updates.phone !== undefined) {
      setParts.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }

    if (updates.customFields !== undefined) {
      setParts.push(`custom_fields = $${paramIndex++}`);
      values.push(JSON.stringify(updates.customFields));
    }

    if (updates.tags !== undefined) {
      setParts.push(`tags = $${paramIndex++}`);
      values.push(updates.tags);
    }

    if (updates.subscriptionStatus !== undefined) {
      setParts.push(`subscription_status = $${paramIndex++}`);
      values.push(updates.subscriptionStatus);
    }

    if (setParts.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE contacts 
      SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Contact not found');
    }

    return this.mapRowToContact(result.rows[0]);
  }

  async deleteContact(tenantId: string, contactId: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM contacts WHERE tenant_id = $1 AND id = $2',
      [tenantId, contactId]
    );

    if (result.rowCount === 0) {
      throw new Error('Contact not found');
    }
  }

  async searchContacts(tenantId: string, filters: ContactSearchFilters, limit = 50, offset = 0): Promise<{ contacts: Contact[], total: number }> {
    const whereClauses: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.email) {
      whereClauses.push(`email ILIKE $${paramIndex++}`);
      values.push(`%${filters.email}%`);
    }

    if (filters.firstName) {
      whereClauses.push(`first_name ILIKE $${paramIndex++}`);
      values.push(`%${filters.firstName}%`);
    }

    if (filters.lastName) {
      whereClauses.push(`last_name ILIKE $${paramIndex++}`);
      values.push(`%${filters.lastName}%`);
    }

    if (filters.subscriptionStatus) {
      whereClauses.push(`subscription_status = $${paramIndex++}`);
      values.push(filters.subscriptionStatus);
    }

    if (filters.source) {
      whereClauses.push(`source = $${paramIndex++}`);
      values.push(filters.source);
    }

    if (filters.tags && filters.tags.length > 0) {
      whereClauses.push(`tags && $${paramIndex++}`);
      values.push(filters.tags);
    }

    if (filters.createdAfter) {
      whereClauses.push(`created_at >= $${paramIndex++}`);
      values.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      whereClauses.push(`created_at <= $${paramIndex++}`);
      values.push(filters.createdBefore);
    }

    const whereClause = whereClauses.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM contacts WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get contacts
    const contactsQuery = `
      SELECT * FROM contacts 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    values.push(limit, offset);

    const contactsResult = await pool.query(contactsQuery, values);
    const contacts = contactsResult.rows.map(row => this.mapRowToContact(row));

    return { contacts, total };
  }

  // Contact List Management
  async createContactList(tenantId: string, listData: CreateContactListRequest): Promise<ContactList> {
    const result = await pool.query(`
      INSERT INTO contact_lists (tenant_id, name, description, is_suppression_list)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [tenantId, listData.name, listData.description, listData.isSuppressionList || false]);

    return this.mapRowToContactList(result.rows[0]);
  }

  async getContactList(tenantId: string, listId: string): Promise<ContactList | null> {
    const result = await pool.query(
      'SELECT * FROM contact_lists WHERE tenant_id = $1 AND id = $2',
      [tenantId, listId]
    );

    return result.rows.length > 0 ? this.mapRowToContactList(result.rows[0]) : null;
  }

  async updateContactList(tenantId: string, listId: string, updates: UpdateContactListRequest): Promise<ContactList> {
    const setParts: string[] = [];
    const values: any[] = [tenantId, listId];
    let paramIndex = 3;

    if (updates.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      setParts.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (setParts.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE contact_lists 
      SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Contact list not found');
    }

    return this.mapRowToContactList(result.rows[0]);
  }

  async deleteContactList(tenantId: string, listId: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM contact_lists WHERE tenant_id = $1 AND id = $2',
      [tenantId, listId]
    );

    if (result.rowCount === 0) {
      throw new Error('Contact list not found');
    }
  }

  async getContactLists(tenantId: string): Promise<ContactList[]> {
    const result = await pool.query(
      'SELECT * FROM contact_lists WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );

    return result.rows.map(row => this.mapRowToContactList(row));
  }

  async addContactToList(tenantId: string, contactId: string, listId: string): Promise<void> {
    const client = await pool.connect();

    try {
      // Verify contact and list belong to tenant
      const contactCheck = await client.query(
        'SELECT id FROM contacts WHERE tenant_id = $1 AND id = $2',
        [tenantId, contactId]
      );

      const listCheck = await client.query(
        'SELECT id FROM contact_lists WHERE tenant_id = $1 AND id = $2',
        [tenantId, listId]
      );

      if (contactCheck.rows.length === 0) {
        throw new Error('Contact not found');
      }

      if (listCheck.rows.length === 0) {
        throw new Error('Contact list not found');
      }

      // Add to list (ON CONFLICT DO NOTHING handles duplicates)
      await client.query(`
        INSERT INTO contact_list_memberships (contact_id, list_id)
        VALUES ($1, $2)
        ON CONFLICT (contact_id, list_id) DO NOTHING
      `, [contactId, listId]);

    } finally {
      client.release();
    }
  }

  async removeContactFromList(tenantId: string, contactId: string, listId: string): Promise<void> {
    // Verify ownership through joins
    const result = await pool.query(`
      DELETE FROM contact_list_memberships 
      WHERE contact_id = $1 AND list_id = $2
      AND EXISTS (
        SELECT 1 FROM contacts c 
        JOIN contact_lists cl ON cl.tenant_id = c.tenant_id
        WHERE c.id = $1 AND cl.id = $2 AND c.tenant_id = $3
      )
    `, [contactId, listId, tenantId]);

    if (result.rowCount === 0) {
      throw new Error('Contact not found in list or access denied');
    }
  }

  async getContactsInList(tenantId: string, listId: string, limit = 50, offset = 0): Promise<{ contacts: Contact[], total: number }> {
    // Verify list ownership
    const listCheck = await pool.query(
      'SELECT id FROM contact_lists WHERE tenant_id = $1 AND id = $2',
      [tenantId, listId]
    );

    if (listCheck.rows.length === 0) {
      throw new Error('Contact list not found');
    }

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM contact_list_memberships clm
      JOIN contacts c ON c.id = clm.contact_id
      WHERE clm.list_id = $1 AND c.tenant_id = $2
    `, [listId, tenantId]);

    const total = parseInt(countResult.rows[0].count);

    // Get contacts
    const contactsResult = await pool.query(`
      SELECT c.* FROM contacts c
      JOIN contact_list_memberships clm ON c.id = clm.contact_id
      WHERE clm.list_id = $1 AND c.tenant_id = $2
      ORDER BY clm.added_at DESC
      LIMIT $3 OFFSET $4
    `, [listId, tenantId, limit, offset]);

    const contacts = contactsResult.rows.map(row => this.mapRowToContact(row));

    return { contacts, total };
  }

  // Suppression List Management
  async addToSuppressionList(tenantId: string, email: string, type: SuppressionType, reason?: string, sourceCampaignId?: string): Promise<void> {
    await pool.query(`
      INSERT INTO suppression_entries (tenant_id, email, suppression_type, reason, source_campaign_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, email, suppression_type) DO NOTHING
    `, [tenantId, email, type, reason, sourceCampaignId]);

    // Update contact status if exists
    await pool.query(`
      UPDATE contacts 
      SET subscription_status = CASE 
        WHEN $3 = 'bounce' THEN 'bounced'
        WHEN $3 = 'complaint' THEN 'complained'
        WHEN $3 = 'unsubscribe' THEN 'unsubscribed'
        ELSE subscription_status
      END
      WHERE tenant_id = $1 AND email = $2
    `, [tenantId, email, type]);
  }

  async removeFromSuppressionList(tenantId: string, email: string, type?: SuppressionType): Promise<void> {
    let query = 'DELETE FROM suppression_entries WHERE tenant_id = $1 AND email = $2';
    const values: any[] = [tenantId, email];

    if (type) {
      query += ' AND suppression_type = $3';
      values.push(type);
    }

    await pool.query(query, values);
  }

  async isEmailSuppressed(tenantId: string, email: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT id FROM suppression_entries WHERE tenant_id = $1 AND email = $2 LIMIT 1',
      [tenantId, email]
    );

    return result.rows.length > 0;
  }

  async getSuppressionList(tenantId: string, type?: SuppressionType): Promise<SuppressionEntry[]> {
    let query = 'SELECT * FROM suppression_entries WHERE tenant_id = $1';
    const values: any[] = [tenantId];

    if (type) {
      query += ' AND suppression_type = $2';
      values.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    return result.rows.map(row => this.mapRowToSuppressionEntry(row));
  }

  // CSV Import/Export Functionality
  async importContactsFromCSV(
    tenantId: string,
    fileBuffer: Buffer,
    filename: string,
    mapping: CSVImportMapping,
    options: ImportContactsRequest
  ): Promise<ContactImportResult> {
    // Create import job
    const jobResult = await pool.query(`
      INSERT INTO contact_import_jobs (tenant_id, filename, file_size, status)
      VALUES ($1, $2, $3, 'processing')
      RETURNING *
    `, [tenantId, filename, fileBuffer.length]);

    const job = jobResult.rows[0];
    const jobId = job.id;

    try {
      // Parse CSV
      const csvData = await this.parseCSV(fileBuffer, mapping);

      // Update job with total rows
      await pool.query(
        'UPDATE contact_import_jobs SET total_rows = $1 WHERE id = $2',
        [csvData.length, jobId]
      );

      // Process contacts
      const results = await this.processImportedContacts(
        tenantId,
        csvData,
        options,
        jobId
      );

      // Update job status
      await pool.query(`
        UPDATE contact_import_jobs 
        SET status = 'completed', 
            processed_rows = $1,
            successful_imports = $2,
            failed_imports = $3,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [results.totalRows, results.successfulImports, results.failedImports, jobId]);

      return {
        jobId,
        totalRows: results.totalRows,
        successfulImports: results.successfulImports,
        failedImports: results.failedImports,
        errors: results.errors
      };

    } catch (error) {
      // Update job status to failed
      await pool.query(`
        UPDATE contact_import_jobs 
        SET status = 'failed', 
            error_details = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), jobId]);

      throw error;
    }
  }

  async exportContacts(tenantId: string, request: ContactExportRequest): Promise<ContactExportResult> {
    let query = 'SELECT * FROM contacts WHERE tenant_id = $1';
    const values: any[] = [tenantId];
    let paramIndex = 2;

    // Add filters
    if (request.listIds && request.listIds.length > 0) {
      query += ` AND id IN (
        SELECT contact_id FROM contact_list_memberships 
        WHERE list_id = ANY($${paramIndex++})
      )`;
      values.push(request.listIds);
    }

    if (request.filters) {
      const { whereClauses, additionalValues } = this.buildWhereClausesFromFilters(request.filters, paramIndex);
      if (whereClauses.length > 0) {
        query += ` AND ${whereClauses.join(' AND ')}`;
        values.push(...additionalValues);
      }
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    const contacts = result.rows.map(row => this.mapRowToContact(row));

    // Generate export file
    const filename = `contacts_export_${Date.now()}.${request.format}`;
    const exportData = request.format === 'csv'
      ? this.generateCSV(contacts)
      : JSON.stringify(contacts, null, 2);

    // In a real implementation, you'd save this to S3 or similar storage
    // For now, we'll return a mock URL
    const downloadUrl = `/api/exports/${filename}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      downloadUrl,
      filename,
      totalContacts: contacts.length,
      expiresAt
    };
  }

  // Contact Engagement Tracking
  async recordEngagementEvent(event: Omit<ContactEngagementEvent, 'id' | 'timestamp'>): Promise<void> {
    await pool.query(`
      INSERT INTO contact_engagement_events (contact_id, campaign_id, event_type, event_data, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      event.contactId,
      event.campaignId,
      event.eventType,
      JSON.stringify(event.eventData),
      event.ipAddress,
      event.userAgent
    ]);
  }

  async getContactEngagement(contactId: string): Promise<ContactEngagementSummary> {
    const result = await pool.query(`
      SELECT 
        contact_id,
        COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as total_sent,
        COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as total_opened,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as total_clicked,
        COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as total_bounced,
        COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as total_complaints,
        MAX(timestamp) as last_engagement
      FROM contact_engagement_events
      WHERE contact_id = $1
      GROUP BY contact_id
    `, [contactId]);

    if (result.rows.length === 0) {
      return {
        contactId,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        totalComplaints: 0,
        engagementScore: 0
      };
    }

    const row = result.rows[0];
    const engagementScore = this.calculateEngagementScore(row);

    return {
      contactId: row.contact_id,
      totalSent: parseInt(row.total_sent),
      totalDelivered: parseInt(row.total_delivered),
      totalOpened: parseInt(row.total_opened),
      totalClicked: parseInt(row.total_clicked),
      totalBounced: parseInt(row.total_bounced),
      totalComplaints: parseInt(row.total_complaints),
      lastEngagement: row.last_engagement,
      engagementScore
    };
  }

  // Helper Methods
  private async addContactToLists(client: PoolClient, contactId: string, listIds: string[]): Promise<void> {
    for (const listId of listIds) {
      await client.query(`
        INSERT INTO contact_list_memberships (contact_id, list_id)
        VALUES ($1, $2)
        ON CONFLICT (contact_id, list_id) DO NOTHING
      `, [contactId, listId]);
    }
  }

  private mapRowToContact(row: any): Contact {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      customFields: row.custom_fields || {},
      subscriptionStatus: row.subscription_status,
      source: row.source,
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToContactList(row: any): ContactList {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      contactCount: row.contact_count,
      isSuppressionList: row.is_suppression_list,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToSuppressionEntry(row: any): SuppressionEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      suppressionType: row.suppression_type,
      reason: row.reason,
      sourceCampaignId: row.source_campaign_id,
      createdAt: row.created_at
    };
  }

  private calculateEngagementScore(engagementData: any): number {
    const sent = parseInt(engagementData.total_sent) || 0;
    const opened = parseInt(engagementData.total_opened) || 0;
    const clicked = parseInt(engagementData.total_clicked) || 0;
    const bounced = parseInt(engagementData.total_bounced) || 0;
    const complaints = parseInt(engagementData.total_complaints) || 0;

    if (sent === 0) return 0;

    const openRate = opened / sent;
    const clickRate = clicked / sent;
    const bounceRate = bounced / sent;
    const complaintRate = complaints / sent;

    // Simple engagement score calculation (0-100)
    let score = (openRate * 40) + (clickRate * 60) - (bounceRate * 30) - (complaintRate * 50);
    return Math.max(0, Math.min(100, Math.round(score * 100)));
  }

  private async parseCSV(fileBuffer: Buffer, mapping: CSVImportMapping): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(fileBuffer.toString());

      stream
        .pipe(csv())
        .on('data', (data: any) => {
          const mappedData: any = {
            email: data[mapping.email]
          };

          if (mapping.firstName) mappedData.firstName = data[mapping.firstName];
          if (mapping.lastName) mappedData.lastName = data[mapping.lastName];
          if (mapping.phone) mappedData.phone = data[mapping.phone];

          if (mapping.customFields) {
            mappedData.customFields = {};
            Object.entries(mapping.customFields).forEach(([csvColumn, fieldName]) => {
              mappedData.customFields[fieldName] = data[csvColumn];
            });
          }

          results.push(mappedData);
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  private async processImportedContacts(
    tenantId: string,
    contacts: any[],
    options: ImportContactsRequest,
    jobId: string
  ): Promise<{ totalRows: number, successfulImports: number, failedImports: number, errors: ImportError[] }> {
    let successfulImports = 0;
    let failedImports = 0;
    const errors: ImportError[] = [];

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create list if needed
      let listId = options.listId;
      if (options.createNewList && options.newListName) {
        const listResult = await client.query(`
          INSERT INTO contact_lists (tenant_id, name)
          VALUES ($1, $2)
          RETURNING id
        `, [tenantId, options.newListName]);
        listId = listResult.rows[0].id;

        // Update job with list ID
        await client.query(
          'UPDATE contact_import_jobs SET list_id = $1 WHERE id = $2',
          [listId, jobId]
        );
      }

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        try {
          // Validate email
          if (!contact.email || !this.isValidEmail(contact.email)) {
            errors.push({
              row: i + 1,
              email: contact.email,
              error: 'Invalid email address'
            });
            failedImports++;
            continue;
          }

          // Check if contact exists
          const existingContact = await client.query(
            'SELECT id FROM contacts WHERE tenant_id = $1 AND email = $2',
            [tenantId, contact.email]
          );

          let contactId: string;

          if (existingContact.rows.length > 0) {
            if (options.skipDuplicates) {
              continue;
            } else if (options.updateExisting) {
              // Update existing contact
              const updateResult = await client.query(`
                UPDATE contacts 
                SET first_name = COALESCE($3, first_name),
                    last_name = COALESCE($4, last_name),
                    phone = COALESCE($5, phone),
                    custom_fields = COALESCE($6, custom_fields),
                    updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = $1 AND email = $2
                RETURNING id
              `, [
                tenantId,
                contact.email,
                contact.firstName,
                contact.lastName,
                contact.phone,
                JSON.stringify(contact.customFields || {})
              ]);
              contactId = updateResult.rows[0].id;
            } else {
              errors.push({
                row: i + 1,
                email: contact.email,
                error: 'Contact already exists'
              });
              failedImports++;
              continue;
            }
          } else {
            // Create new contact
            const createResult = await client.query(`
              INSERT INTO contacts (tenant_id, email, first_name, last_name, phone, custom_fields, source)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id
            `, [
              tenantId,
              contact.email,
              contact.firstName,
              contact.lastName,
              contact.phone,
              JSON.stringify(contact.customFields || {}),
              ContactSource.IMPORT
            ]);
            contactId = createResult.rows[0].id;
          }

          // Add to list if specified
          if (listId) {
            await client.query(`
              INSERT INTO contact_list_memberships (contact_id, list_id, added_by)
              VALUES ($1, $2, 'import')
              ON CONFLICT (contact_id, list_id) DO NOTHING
            `, [contactId, listId]);
          }

          successfulImports++;

        } catch (error) {
          errors.push({
            row: i + 1,
            email: contact.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedImports++;
        }
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return {
      totalRows: contacts.length,
      successfulImports,
      failedImports,
      errors
    };
  }

  private generateCSV(contacts: Contact[]): string {
    const headers = ['email', 'firstName', 'lastName', 'phone', 'subscriptionStatus', 'source', 'createdAt'];
    const csvRows = [headers.join(',')];

    contacts.forEach(contact => {
      const row = [
        contact.email,
        contact.firstName || '',
        contact.lastName || '',
        contact.phone || '',
        contact.subscriptionStatus,
        contact.source,
        contact.createdAt.toISOString()
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return csvRows.join('\n');
  }

  private buildWhereClausesFromFilters(filters: ContactSearchFilters, startIndex: number): { whereClauses: string[], additionalValues: any[] } {
    const whereClauses: string[] = [];
    const additionalValues: any[] = [];
    let paramIndex = startIndex;

    if (filters.email) {
      whereClauses.push(`email ILIKE $${paramIndex++}`);
      additionalValues.push(`%${filters.email}%`);
    }

    if (filters.subscriptionStatus) {
      whereClauses.push(`subscription_status = $${paramIndex++}`);
      additionalValues.push(filters.subscriptionStatus);
    }

    return { whereClauses, additionalValues };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}