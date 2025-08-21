import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dns from 'dns';
import { promisify } from 'util';
import {
  Domain,
  DomainStatus,
  DNSRecord,
  DNSRecordType,
  DomainVerificationResult,
  DNSRecordVerification,
  DomainSetupWizard,
  SetupInstructions,
  SetupStep,
  DomainReputation,
  ReputationFactor,
  DomainAlert,
  AlertType,
  AlertSeverity,
  CreateDomainRequest,
  UpdateDomainRequest,
  DomainMonitoringConfig
} from './domain.types';

const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveMx = promisify(dns.resolveMx);

export class DomainService {
  constructor(private db: Pool) {}

  /**
   * Create a new domain for verification
   */
  async createDomain(request: CreateDomainRequest): Promise<Domain> {
    const id = uuidv4();
    const dkimKey = this.generateDKIMKey();
    const verificationRecords = this.generateVerificationRecords(request.domain, dkimKey);

    const query = `
      INSERT INTO domains (id, tenant_id, domain, status, dkim_key, verification_records)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      id,
      request.tenantId,
      request.domain,
      DomainStatus.PENDING,
      dkimKey,
      JSON.stringify(verificationRecords)
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToDomain(result.rows[0]);
  }

  /**
   * Get domain by ID
   */
  async getDomainById(id: string): Promise<Domain | null> {
    const query = 'SELECT * FROM domains WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDomain(result.rows[0]);
  }

  /**
   * Get all domains for a tenant
   */
  async getDomainsByTenant(tenantId: string): Promise<Domain[]> {
    const query = 'SELECT * FROM domains WHERE tenant_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [tenantId]);
    
    return result.rows.map(row => this.mapRowToDomain(row));
  }

  /**
   * Generate DNS records for domain verification
   */
  generateVerificationRecords(domain: string, dkimKey: string): DNSRecord[] {
    const records: DNSRecord[] = [];

    // SPF Record
    records.push({
      type: DNSRecordType.TXT,
      name: domain,
      value: 'v=spf1 include:amazonses.com ~all',
      ttl: 300
    });

    // DKIM Record
    records.push({
      type: DNSRecordType.TXT,
      name: `mail._domainkey.${domain}`,
      value: `v=DKIM1; k=rsa; p=${dkimKey}`,
      ttl: 300
    });

    // DMARC Record
    records.push({
      type: DNSRecordType.TXT,
      name: `_dmarc.${domain}`,
      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com',
      ttl: 300
    });

    // Domain Verification Record
    const verificationToken = this.generateVerificationToken();
    records.push({
      type: DNSRecordType.TXT,
      name: `_verification.${domain}`,
      value: `bulk-email-platform-verification=${verificationToken}`,
      ttl: 300
    });

    return records;
  }

  /**
   * Create domain setup wizard with step-by-step instructions
   */
  async createSetupWizard(domainId: string): Promise<DomainSetupWizard> {
    const domain = await this.getDomainById(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const records = domain.verificationRecords;
    const spfRecord = records.find(r => r.value.includes('v=spf1'));
    const dkimRecord = records.find(r => r.value.includes('v=DKIM1'));
    const dmarcRecord = records.find(r => r.value.includes('v=DMARC1'));
    const verificationRecord = records.find(r => r.value.includes('bulk-email-platform-verification'));

    if (!spfRecord || !dkimRecord || !dmarcRecord || !verificationRecord) {
      throw new Error('Required DNS records not found');
    }

    const instructions: SetupInstructions = {
      steps: [
        {
          title: 'Add SPF Record',
          description: 'Add this TXT record to authorize email sending from your domain',
          record: spfRecord,
          isCompleted: false
        },
        {
          title: 'Add DKIM Record',
          description: 'Add this TXT record to enable DKIM signing for your emails',
          record: dkimRecord,
          isCompleted: false
        },
        {
          title: 'Add DMARC Record',
          description: 'Add this TXT record to set your DMARC policy',
          record: dmarcRecord,
          isCompleted: false
        },
        {
          title: 'Add Verification Record',
          description: 'Add this TXT record to verify domain ownership',
          record: verificationRecord,
          isCompleted: false
        }
      ],
      estimatedTime: '15-30 minutes'
    };

    return {
      domain: domain.domain,
      spfRecord,
      dkimRecord,
      dmarcRecord,
      verificationRecord,
      instructions
    };
  }

  /**
   * Verify domain DNS records
   */
  async verifyDomain(domainId: string): Promise<DomainVerificationResult> {
    const domain = await this.getDomainById(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const verificationResults: DNSRecordVerification[] = [];
    const errors: string[] = [];
    let allVerified = true;

    // Update domain status to verifying
    await this.updateDomainStatus(domainId, DomainStatus.VERIFYING);

    for (const record of domain.verificationRecords) {
      try {
        const verification = await this.verifyDNSRecord(domain.domain, record);
        verificationResults.push(verification);
        
        if (!verification.isPresent) {
          allVerified = false;
          errors.push(`${record.type} record not found: ${record.name}`);
        }
      } catch (error) {
        allVerified = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to verify ${record.type} record: ${errorMessage}`);
        
        verificationResults.push({
          record,
          isPresent: false,
          error: errorMessage
        });
      }
    }

    // Update domain status based on verification results
    const newStatus = allVerified ? DomainStatus.VERIFIED : DomainStatus.FAILED;
    await this.updateDomainStatus(domainId, newStatus);

    if (allVerified) {
      await this.markDomainAsVerified(domainId);
    } else {
      await this.createAlert(domainId, AlertType.VERIFICATION_FAILED, AlertSeverity.HIGH, 
        `Domain verification failed: ${errors.join(', ')}`);
    }

    return {
      domain: domain.domain,
      isVerified: allVerified,
      records: verificationResults,
      errors
    };
  }

  /**
   * Verify individual DNS record
   */
  private async verifyDNSRecord(domain: string, record: DNSRecord): Promise<DNSRecordVerification> {
    try {
      let currentValue: string | undefined;
      let isPresent = false;

      switch (record.type) {
        case DNSRecordType.TXT:
          const txtRecords = await resolveTxt(record.name);
          const flatTxtRecords = txtRecords.flat();
          currentValue = flatTxtRecords.find(txt => 
            txt.includes(record.value) || record.value.includes(txt)
          );
          isPresent = !!currentValue;
          break;

        case DNSRecordType.CNAME:
          const cnameRecords = await resolveCname(record.name);
          currentValue = cnameRecords[0];
          isPresent = currentValue === record.value;
          break;

        case DNSRecordType.MX:
          const mxRecords = await resolveMx(record.name);
          currentValue = mxRecords.map(mx => mx.exchange).join(', ');
          isPresent = mxRecords.some(mx => mx.exchange === record.value);
          break;

        default:
          throw new Error(`Unsupported record type: ${record.type}`);
      }

      return {
        record,
        isPresent,
        currentValue
      };
    } catch (error) {
      return {
        record,
        isPresent: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Monitor domain status and reputation
   */
  async monitorDomain(domainId: string): Promise<void> {
    const domain = await this.getDomainById(domainId);
    if (!domain || domain.status !== DomainStatus.VERIFIED) {
      return;
    }

    // Check DNS records are still valid
    const verificationResult = await this.verifyDomain(domainId);
    if (!verificationResult.isVerified) {
      await this.createAlert(domainId, AlertType.DNS_RECORD_MISSING, AlertSeverity.HIGH,
        'DNS records are no longer valid');
    }

    // Update domain reputation
    await this.updateDomainReputation(domainId);

    // Log monitoring check
    await this.logMonitoringCheck(domainId, 'full_check', 'completed', {
      dnsVerified: verificationResult.isVerified,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Update domain reputation based on various factors
   */
  async updateDomainReputation(domainId: string): Promise<DomainReputation> {
    const domain = await this.getDomainById(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    // Calculate reputation factors (simplified for demo)
    const factors: ReputationFactor[] = [
      {
        name: 'DNS Authentication',
        score: domain.status === DomainStatus.VERIFIED ? 100 : 0,
        weight: 0.3,
        description: 'SPF, DKIM, and DMARC records are properly configured',
        status: domain.status === DomainStatus.VERIFIED ? 'good' : 'critical'
      },
      {
        name: 'Sending History',
        score: 85, // This would be calculated from actual sending data
        weight: 0.4,
        description: 'Historical email sending patterns and engagement',
        status: 'good'
      },
      {
        name: 'Complaint Rate',
        score: 95, // This would be calculated from actual complaint data
        weight: 0.3,
        description: 'Rate of spam complaints and unsubscribes',
        status: 'good'
      }
    ];

    // Calculate overall score
    const overallScore = Math.round(
      factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0)
    );

    const recommendations: string[] = [];
    if (overallScore < 70) {
      recommendations.push('Consider reviewing your email content and targeting');
      recommendations.push('Monitor bounce and complaint rates closely');
    }
    if (domain.status !== DomainStatus.VERIFIED) {
      recommendations.push('Complete domain verification to improve reputation');
    }

    // Save reputation to database
    const query = `
      INSERT INTO domain_reputation (domain_id, score, factors, recommendations)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (domain_id) DO UPDATE SET
        score = EXCLUDED.score,
        factors = EXCLUDED.factors,
        recommendations = EXCLUDED.recommendations,
        last_updated = NOW()
      RETURNING *
    `;

    const values = [
      domainId,
      overallScore,
      JSON.stringify(factors),
      JSON.stringify(recommendations)
    ];

    await this.db.query(query, values);

    return {
      domain: domain.domain,
      score: overallScore,
      factors,
      lastUpdated: new Date(),
      recommendations
    };
  }

  /**
   * Get domain reputation
   */
  async getDomainReputation(domainId: string): Promise<DomainReputation | null> {
    const query = `
      SELECT dr.*, d.domain 
      FROM domain_reputation dr
      JOIN domains d ON d.id = dr.domain_id
      WHERE dr.domain_id = $1
      ORDER BY dr.last_updated DESC
      LIMIT 1
    `;
    
    const result = await this.db.query(query, [domainId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      domain: row.domain,
      score: row.score,
      factors: JSON.parse(row.factors),
      lastUpdated: row.last_updated,
      recommendations: JSON.parse(row.recommendations)
    };
  }

  /**
   * Create domain alert
   */
  async createAlert(
    domainId: string, 
    type: AlertType, 
    severity: AlertSeverity, 
    message: string,
    details: Record<string, any> = {}
  ): Promise<DomainAlert> {
    const id = uuidv4();
    const query = `
      INSERT INTO domain_alerts (id, domain_id, type, severity, message, details)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [id, domainId, type, severity, message, JSON.stringify(details)];
    const result = await this.db.query(query, values);
    
    return this.mapRowToAlert(result.rows[0]);
  }

  /**
   * Get domain alerts
   */
  async getDomainAlerts(domainId: string, includeResolved = false): Promise<DomainAlert[]> {
    let query = 'SELECT * FROM domain_alerts WHERE domain_id = $1';
    const values = [domainId];

    if (!includeResolved) {
      query += ' AND is_resolved = FALSE';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToAlert(row));
  }

  /**
   * Resolve domain alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const query = `
      UPDATE domain_alerts 
      SET is_resolved = TRUE, resolved_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [alertId]);
  }

  // Helper methods

  private async updateDomainStatus(domainId: string, status: DomainStatus): Promise<void> {
    const query = 'UPDATE domains SET status = $1 WHERE id = $2';
    await this.db.query(query, [status, domainId]);
  }

  private async markDomainAsVerified(domainId: string): Promise<void> {
    const query = 'UPDATE domains SET verified_at = NOW() WHERE id = $1';
    await this.db.query(query, [domainId]);
  }

  private async logMonitoringCheck(
    domainId: string, 
    checkType: string, 
    status: string, 
    results: Record<string, any>
  ): Promise<void> {
    const query = `
      INSERT INTO domain_monitoring_logs (domain_id, check_type, status, results)
      VALUES ($1, $2, $3, $4)
    `;
    
    await this.db.query(query, [domainId, checkType, status, JSON.stringify(results)]);
  }

  private generateDKIMKey(): string {
    // In a real implementation, this would generate a proper RSA key pair
    // For demo purposes, returning a placeholder
    return 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...'; // Truncated for brevity
  }

  private generateVerificationToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private mapRowToDomain(row: any): Domain {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      domain: row.domain,
      status: row.status as DomainStatus,
      dkimKey: row.dkim_key,
      verificationRecords: JSON.parse(row.verification_records || '[]'),
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToAlert(row: any): DomainAlert {
    return {
      id: row.id,
      domainId: row.domain_id,
      type: row.type as AlertType,
      severity: row.severity as AlertSeverity,
      message: row.message,
      details: JSON.parse(row.details || '{}'),
      isResolved: row.is_resolved,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    };
  }
}