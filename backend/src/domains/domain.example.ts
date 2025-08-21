/**
 * Domain Management System Example
 * 
 * This example demonstrates how to use the domain management system
 * for custom domain setup, verification, and monitoring.
 */

import { Pool } from 'pg';
import { DomainService } from './domain.service';
import { DomainMonitoringService } from './domain-monitoring.service';
import { DomainStatus } from './domain.types';

// Example usage of the Domain Management System
export async function domainManagementExample(db: Pool) {
  const domainService = new DomainService(db);
  const monitoringService = new DomainMonitoringService(db, domainService);

  console.log('🚀 Domain Management System Example');
  console.log('=====================================');

  try {
    // 1. Create a new domain
    console.log('\n1. Creating a new domain...');
    const newDomain = await domainService.createDomain({
      domain: 'mail.example.com',
      tenantId: 'example-tenant-id'
    });
    console.log(`✅ Domain created: ${newDomain.domain} (ID: ${newDomain.id})`);
    console.log(`   Status: ${newDomain.status}`);

    // 2. Get setup wizard instructions
    console.log('\n2. Getting setup wizard instructions...');
    const wizard = await domainService.createSetupWizard(newDomain.id);
    console.log(`📋 Setup instructions for ${wizard.domain}:`);
    
    wizard.instructions.steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.title}`);
      console.log(`      Type: ${step.record.type}`);
      console.log(`      Name: ${step.record.name}`);
      console.log(`      Value: ${step.record.value}`);
      console.log(`      TTL: ${step.record.ttl}`);
      console.log('');
    });

    // 3. Simulate domain verification (would normally check real DNS)
    console.log('3. Simulating domain verification...');
    try {
      const verificationResult = await domainService.verifyDomain(newDomain.id);
      console.log(`🔍 Verification result for ${verificationResult.domain}:`);
      console.log(`   Verified: ${verificationResult.isVerified}`);
      
      if (verificationResult.errors.length > 0) {
        console.log('   Errors:');
        verificationResult.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
      }
    } catch (error) {
      console.log(`⚠️  Verification failed (expected in demo): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 4. Update domain reputation
    console.log('\n4. Calculating domain reputation...');
    const reputation = await domainService.updateDomainReputation(newDomain.id);
    console.log(`📊 Domain reputation for ${reputation.domain}:`);
    console.log(`   Overall Score: ${reputation.score}/100`);
    console.log('   Factors:');
    
    reputation.factors.forEach(factor => {
      console.log(`     - ${factor.name}: ${factor.score}/100 (${factor.status})`);
      console.log(`       ${factor.description}`);
    });

    if (reputation.recommendations.length > 0) {
      console.log('   Recommendations:');
      reputation.recommendations.forEach(rec => {
        console.log(`     - ${rec}`);
      });
    }

    // 5. Create a sample alert
    console.log('\n5. Creating a sample alert...');
    const alert = await domainService.createAlert(
      newDomain.id,
      'verification_failed' as any,
      'medium' as any,
      'This is a demo alert for testing purposes'
    );
    console.log(`🚨 Alert created: ${alert.message}`);
    console.log(`   Severity: ${alert.severity}`);
    console.log(`   Type: ${alert.type}`);

    // 6. Get domain alerts
    console.log('\n6. Getting domain alerts...');
    const alerts = await domainService.getDomainAlerts(newDomain.id);
    console.log(`📢 Found ${alerts.length} unresolved alerts:`);
    
    alerts.forEach((alert, index) => {
      console.log(`   ${index + 1}. ${alert.message} (${alert.severity})`);
      console.log(`      Created: ${alert.createdAt}`);
      console.log(`      Resolved: ${alert.isResolved}`);
    });

    // 7. Resolve the alert
    if (alerts.length > 0) {
      console.log('\n7. Resolving the first alert...');
      await domainService.resolveAlert(alerts[0].id);
      console.log('✅ Alert resolved successfully');
    }

    // 8. Start monitoring (in a real application)
    console.log('\n8. Domain monitoring configuration...');
    const monitoringConfig = monitoringService.getConfig();
    console.log('📡 Monitoring Configuration:');
    console.log(`   Check Interval: ${monitoringConfig.checkInterval} minutes`);
    console.log(`   DNS Records Check: ${monitoringConfig.enabledChecks.dnsRecords ? 'Enabled' : 'Disabled'}`);
    console.log(`   Reputation Check: ${monitoringConfig.enabledChecks.reputation ? 'Enabled' : 'Disabled'}`);
    console.log(`   Deliverability Check: ${monitoringConfig.enabledChecks.deliverability ? 'Enabled' : 'Disabled'}`);
    
    console.log('\n   Alert Thresholds:');
    console.log(`     Reputation Score: ${monitoringConfig.alertThresholds.reputationScore}`);
    console.log(`     Delivery Rate: ${monitoringConfig.alertThresholds.deliveryRate}%`);
    console.log(`     Bounce Rate: ${monitoringConfig.alertThresholds.bounceRate}%`);

    // 9. Manual monitoring check
    console.log('\n9. Running manual monitoring check...');
    try {
      await monitoringService.monitorSingleDomain(newDomain.id);
      console.log('✅ Monitoring check completed');
    } catch (error) {
      console.log(`⚠️  Monitoring check failed (expected in demo): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 10. Get all domains for tenant
    console.log('\n10. Getting all domains for tenant...');
    const allDomains = await domainService.getDomainsByTenant('example-tenant-id');
    console.log(`📋 Found ${allDomains.length} domains for tenant:`);
    
    allDomains.forEach((domain, index) => {
      console.log(`   ${index + 1}. ${domain.domain} (${domain.status})`);
      console.log(`      Created: ${domain.createdAt}`);
      console.log(`      Verified: ${domain.verifiedAt || 'Not verified'}`);
    });

    console.log('\n🎉 Domain Management System Example Completed!');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Error in domain management example:', error);
  }
}

// Example DNS records that would be added to the domain
export const exampleDNSRecords = {
  spf: {
    type: 'TXT',
    name: 'example.com',
    value: 'v=spf1 include:amazonses.com ~all',
    description: 'Authorizes Amazon SES to send emails on behalf of your domain'
  },
  dkim: {
    type: 'TXT',
    name: 'mail._domainkey.example.com',
    value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...',
    description: 'DKIM public key for email authentication'
  },
  dmarc: {
    type: 'TXT',
    name: '_dmarc.example.com',
    value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com',
    description: 'DMARC policy for email authentication and reporting'
  },
  verification: {
    type: 'TXT',
    name: '_verification.example.com',
    value: 'bulk-email-platform-verification=abc123def456',
    description: 'Domain ownership verification token'
  }
};

// Example API usage
export const exampleAPIUsage = `
// Create a new domain
POST /api/domains
{
  "domain": "mail.example.com"
}

// Get setup wizard
GET /api/domains/{domainId}/setup-wizard

// Verify domain
POST /api/domains/{domainId}/verify

// Get domain reputation
GET /api/domains/{domainId}/reputation

// Get domain alerts
GET /api/domains/{domainId}/alerts

// Resolve an alert
POST /api/domains/{domainId}/alerts/{alertId}/resolve

// Manual monitoring trigger
POST /api/domains/{domainId}/monitor
`;

console.log('Domain Management System Example Available');
console.log('Run: domainManagementExample(db) to see the system in action');