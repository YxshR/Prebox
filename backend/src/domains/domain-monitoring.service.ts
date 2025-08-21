import { Pool } from 'pg';
import { DomainService } from './domain.service';
import { DomainStatus, DomainMonitoringConfig } from './domain.types';

export class DomainMonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private config: DomainMonitoringConfig;

  constructor(
    private db: Pool,
    private domainService: DomainService,
    config?: Partial<DomainMonitoringConfig>
  ) {
    this.config = {
      checkInterval: 60, // 60 minutes default
      alertThresholds: {
        reputationScore: 70,
        deliveryRate: 95,
        bounceRate: 5
      },
      enabledChecks: {
        dnsRecords: true,
        reputation: true,
        deliverability: true
      },
      ...config
    };
  }

  /**
   * Start automated domain monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      console.log('Domain monitoring is already running');
      return;
    }

    console.log(`Starting domain monitoring with ${this.config.checkInterval} minute intervals`);
    
    // Run initial check
    this.runMonitoringCycle().catch(error => {
      console.error('Error in initial monitoring cycle:', error);
    });

    // Schedule recurring checks
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle().catch(error => {
        console.error('Error in monitoring cycle:', error);
      });
    }, this.config.checkInterval * 60 * 1000); // Convert minutes to milliseconds
  }

  /**
   * Stop automated domain monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Domain monitoring stopped');
    }
  }

  /**
   * Run a complete monitoring cycle for all verified domains
   */
  async runMonitoringCycle(): Promise<void> {
    try {
      console.log('Starting domain monitoring cycle...');
      
      const verifiedDomains = await this.getVerifiedDomains();
      console.log(`Found ${verifiedDomains.length} verified domains to monitor`);

      const monitoringPromises = verifiedDomains.map(domain => 
        this.monitorSingleDomain(domain.id).catch(error => {
          console.error(`Error monitoring domain ${domain.domain}:`, error);
        })
      );

      await Promise.all(monitoringPromises);
      console.log('Domain monitoring cycle completed');
    } catch (error) {
      console.error('Error in monitoring cycle:', error);
    }
  }

  /**
   * Monitor a single domain
   */
  async monitorSingleDomain(domainId: string): Promise<void> {
    try {
      const domain = await this.domainService.getDomainById(domainId);
      if (!domain || domain.status !== DomainStatus.VERIFIED) {
        return;
      }

      console.log(`Monitoring domain: ${domain.domain}`);

      // Check DNS records if enabled
      if (this.config.enabledChecks.dnsRecords) {
        await this.checkDNSRecords(domainId);
      }

      // Update reputation if enabled
      if (this.config.enabledChecks.reputation) {
        await this.checkReputation(domainId);
      }

      // Check deliverability if enabled
      if (this.config.enabledChecks.deliverability) {
        await this.checkDeliverability(domainId);
      }

    } catch (error) {
      console.error(`Error monitoring domain ${domainId}:`, error);
    }
  }

  /**
   * Check DNS records for a domain
   */
  private async checkDNSRecords(domainId: string): Promise<void> {
    try {
      const verificationResult = await this.domainService.verifyDomain(domainId);
      
      if (!verificationResult.isVerified) {
        console.log(`DNS verification failed for domain ${domainId}`);
        // Alert is already created in the verifyDomain method
      }
    } catch (error) {
      console.error(`Error checking DNS records for domain ${domainId}:`, error);
    }
  }

  /**
   * Check and update domain reputation
   */
  private async checkReputation(domainId: string): Promise<void> {
    try {
      const reputation = await this.domainService.updateDomainReputation(domainId);
      
      if (reputation.score < this.config.alertThresholds.reputationScore) {
        await this.domainService.createAlert(
          domainId,
          'reputation_decline' as any,
          'medium' as any,
          `Domain reputation score (${reputation.score}) is below threshold (${this.config.alertThresholds.reputationScore})`,
          { score: reputation.score, threshold: this.config.alertThresholds.reputationScore }
        );
      }
    } catch (error) {
      console.error(`Error checking reputation for domain ${domainId}:`, error);
    }
  }

  /**
   * Check deliverability metrics
   */
  private async checkDeliverability(domainId: string): Promise<void> {
    try {
      // This would integrate with actual email delivery metrics
      // For now, we'll simulate the check
      const deliverabilityMetrics = await this.getDeliverabilityMetrics(domainId);
      
      if (deliverabilityMetrics.deliveryRate < this.config.alertThresholds.deliveryRate) {
        await this.domainService.createAlert(
          domainId,
          'delivery_issues' as any,
          'high' as any,
          `Low delivery rate detected: ${deliverabilityMetrics.deliveryRate}%`,
          deliverabilityMetrics
        );
      }

      if (deliverabilityMetrics.bounceRate > this.config.alertThresholds.bounceRate) {
        await this.domainService.createAlert(
          domainId,
          'delivery_issues' as any,
          'medium' as any,
          `High bounce rate detected: ${deliverabilityMetrics.bounceRate}%`,
          deliverabilityMetrics
        );
      }
    } catch (error) {
      console.error(`Error checking deliverability for domain ${domainId}:`, error);
    }
  }

  /**
   * Get verified domains from database
   */
  private async getVerifiedDomains(): Promise<Array<{ id: string; domain: string }>> {
    const query = `
      SELECT id, domain 
      FROM domains 
      WHERE status = $1
      ORDER BY verified_at DESC
    `;
    
    const result = await this.db.query(query, [DomainStatus.VERIFIED]);
    return result.rows;
  }

  /**
   * Get deliverability metrics for a domain
   * In a real implementation, this would query actual email delivery data
   */
  private async getDeliverabilityMetrics(domainId: string): Promise<{
    deliveryRate: number;
    bounceRate: number;
    complaintRate: number;
    openRate: number;
    clickRate: number;
  }> {
    // This is a simplified implementation
    // In reality, you would query email_events table and calculate these metrics
    const query = `
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN event_type = 'complained' THEN 1 END) as complained,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as opened,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as clicked
      FROM email_events ee
      JOIN campaigns c ON c.id = ee.campaign_id
      JOIN domains d ON d.tenant_id = c.tenant_id
      WHERE d.id = $1
        AND ee.timestamp >= NOW() - INTERVAL '7 days'
    `;

    try {
      const result = await this.db.query(query, [domainId]);
      const row = result.rows[0];
      
      const totalEmails = parseInt(row.total_emails) || 1; // Avoid division by zero
      const delivered = parseInt(row.delivered) || 0;
      const bounced = parseInt(row.bounced) || 0;
      const complained = parseInt(row.complained) || 0;
      const opened = parseInt(row.opened) || 0;
      const clicked = parseInt(row.clicked) || 0;

      return {
        deliveryRate: Math.round((delivered / totalEmails) * 100),
        bounceRate: Math.round((bounced / totalEmails) * 100),
        complaintRate: Math.round((complained / totalEmails) * 100),
        openRate: Math.round((opened / delivered) * 100) || 0,
        clickRate: Math.round((clicked / delivered) * 100) || 0
      };
    } catch (error) {
      console.error('Error getting deliverability metrics:', error);
      // Return default values if query fails
      return {
        deliveryRate: 95,
        bounceRate: 2,
        complaintRate: 0.1,
        openRate: 25,
        clickRate: 3
      };
    }
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<DomainMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring with new interval if it changed
    if (newConfig.checkInterval && this.monitoringInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Get current monitoring configuration
   */
  getConfig(): DomainMonitoringConfig {
    return { ...this.config };
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    config: DomainMonitoringConfig;
    nextCheckIn?: number; // minutes until next check
  } {
    return {
      isRunning: this.monitoringInterval !== null,
      config: this.config,
      nextCheckIn: this.monitoringInterval ? this.config.checkInterval : undefined
    };
  }
}