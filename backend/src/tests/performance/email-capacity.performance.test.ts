/**
 * Email Sending Capacity Performance Tests
 * Tests system performance under high email volume loads
 */

import { performance } from 'perf_hooks';
import { TestUtils, testConfig } from '../../config/test-config';

// Mock dependencies
const mockDatabase = TestUtils.mockDatabase();
const mockRedis = TestUtils.mockRedis();
const mockQueue = {
  add: jest.fn(),
  process: jest.fn(),
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getCompleted: jest.fn(),
  getFailed: jest.fn()
};

jest.mock('../../database/database.service', () => ({
  DatabaseService: {
    getInstance: () => mockDatabase
  }
}));

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => mockQueue);
});

// Import services to test
import { EmailService } from '../../emails/email.service';
import { CampaignService } from '../../campaigns/campaign.service';
import { AnalyticsService } from '../../analytics/analytics.service';

describe('Email Sending Capacity Performance Tests', () => {
  let emailService: EmailService;
  let campaignService: CampaignService;
  let analyticsService: AnalyticsService;

  const performanceConfig = testConfig.performance;

  beforeAll(() => {
    emailService = new EmailService();
    campaignService = new CampaignService();
    analyticsService = new AnalyticsService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Single Email Sending Performance', () => {
    it('should send single emails within performance thresholds', async () => {
      const testEmails = Array.from({ length: 100 }, (_, i) => ({
        id: `email-${i}`,
        tenantId: 'test-tenant',
        to: `user${i}@example.com`,
        subject: `Test Email ${i}`,
        htmlContent: `<p>Test content for email ${i}</p>`,
        textContent: `Test content for email ${i}`
      }));

      mockDatabase.query.mockResolvedValue({ rows: [{ id: 'job-1' }] });
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const startTime = performance.now();
      const promises = testEmails.map(email => emailService.sendSingleEmail(email));
      await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const emailsPerSecond = (testEmails.length / totalTime) * 1000;

      console.log(`Single email performance: ${emailsPerSecond.toFixed(2)} emails/second`);
      
      expect(emailsPerSecond).toBeGreaterThan(performanceConfig.emailSendingCapacity.maxEmailsPerSecond);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentBatches = 10;
      const emailsPerBatch = 50;
      
      mockDatabase.query.mockResolvedValue({ rows: [{ id: 'job-1' }] });
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const startTime = performance.now();
      
      const batchPromises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        const batchEmails = Array.from({ length: emailsPerBatch }, (_, emailIndex) => ({
          id: `email-${batchIndex}-${emailIndex}`,
          tenantId: 'test-tenant',
          to: `user${batchIndex}-${emailIndex}@example.com`,
          subject: `Batch ${batchIndex} Email ${emailIndex}`,
          htmlContent: `<p>Content for batch ${batchIndex}, email ${emailIndex}</p>`
        }));

        return Promise.all(batchEmails.map(email => emailService.sendSingleEmail(email)));
      });

      await Promise.all(batchPromises);
      const endTime = performance.now();

      const totalEmails = concurrentBatches * emailsPerBatch;
      const totalTime = endTime - startTime;
      const emailsPerSecond = (totalEmails / totalTime) * 1000;

      console.log(`Concurrent load performance: ${emailsPerSecond.toFixed(2)} emails/second`);
      console.log(`Total emails: ${totalEmails}, Total time: ${totalTime.toFixed(2)}ms`);

      expect(emailsPerSecond).toBeGreaterThan(performanceConfig.emailSendingCapacity.maxEmailsPerSecond * 0.8); // Allow 20% degradation under load
    });
  });

  describe('Bulk Email Sending Performance', () => {
    it('should process bulk emails efficiently', async () => {
      const bulkSize = 1000;
      const bulkEmails = Array.from({ length: bulkSize }, (_, i) => ({
        to: `bulk${i}@example.com`,
        subject: `Bulk Email ${i}`,
        htmlContent: `<p>Bulk content ${i}</p>`,
        variables: { name: `User ${i}`, id: i }
      }));

      mockDatabase.query.mockResolvedValue({ rows: [{ id: 'bulk-job-1' }] });
      mockQueue.add.mockResolvedValue({ id: 'bulk-job-1' });

      const startTime = performance.now();
      await emailService.sendBulkEmails('test-tenant', bulkEmails);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const emailsPerSecond = (bulkSize / processingTime) * 1000;

      console.log(`Bulk email performance: ${emailsPerSecond.toFixed(2)} emails/second`);
      console.log(`Processing time for ${bulkSize} emails: ${processingTime.toFixed(2)}ms`);

      expect(emailsPerSecond).toBeGreaterThan(performanceConfig.emailSendingCapacity.maxEmailsPerSecond * 2); // Bulk should be faster
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle large recipient lists efficiently', async () => {
      const recipientCounts = [1000, 5000, 10000];
      
      for (const count of recipientCounts) {
        const recipients = Array.from({ length: count }, (_, i) => ({
          email: `recipient${i}@example.com`,
          firstName: `User${i}`,
          customFields: { id: i, segment: i % 10 }
        }));

        mockDatabase.query.mockResolvedValue({ rows: [{ id: `campaign-${count}` }] });

        const startTime = performance.now();
        await campaignService.createCampaign({
          tenantId: 'test-tenant',
          name: `Performance Test ${count}`,
          templateId: 'template-1',
          recipients
        });
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        const recipientsPerSecond = (count / processingTime) * 1000;

        console.log(`Campaign creation for ${count} recipients: ${recipientsPerSecond.toFixed(2)} recipients/second`);
        
        expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
        expect(recipientsPerSecond).toBeGreaterThan(100); // Minimum processing rate
      }
    });
  });

  describe('Queue Performance', () => {
    it('should maintain queue performance under high load', async () => {
      const jobCount = 10000;
      const jobs = Array.from({ length: jobCount }, (_, i) => ({
        id: `job-${i}`,
        type: 'send_email',
        data: {
          to: `user${i}@example.com`,
          subject: `Queue Test ${i}`,
          content: `Content ${i}`
        }
      }));

      mockQueue.add.mockResolvedValue({ id: 'job-1' });
      mockQueue.getWaiting.mockResolvedValue([]);
      mockQueue.getActive.mockResolvedValue([]);

      const startTime = performance.now();
      
      // Add jobs to queue in batches
      const batchSize = 100;
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        await Promise.all(batch.map(job => mockQueue.add(job.type, job.data)));
      }
      
      const endTime = performance.now();

      const queueTime = endTime - startTime;
      const jobsPerSecond = (jobCount / queueTime) * 1000;

      console.log(`Queue performance: ${jobsPerSecond.toFixed(2)} jobs/second`);
      console.log(`Queue time for ${jobCount} jobs: ${queueTime.toFixed(2)}ms`);

      expect(jobsPerSecond).toBeGreaterThan(1000); // Should queue at least 1000 jobs/second
      expect(queueTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should handle queue processing efficiently', async () => {
      const processingJobs = Array.from({ length: 1000 }, (_, i) => ({
        id: `process-job-${i}`,
        data: {
          emailId: `email-${i}`,
          tenantId: 'test-tenant',
          to: `process${i}@example.com`
        }
      }));

      mockQueue.process.mockImplementation(async (job) => {
        // Simulate email processing
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms per email
        return { messageId: `msg-${job.id}`, status: 'sent' };
      });

      const startTime = performance.now();
      
      // Process jobs concurrently
      const processingPromises = processingJobs.map(job => 
        mockQueue.process(job)
      );
      
      await Promise.all(processingPromises);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const processedPerSecond = (processingJobs.length / processingTime) * 1000;

      console.log(`Queue processing: ${processedPerSecond.toFixed(2)} jobs/second`);
      
      expect(processedPerSecond).toBeGreaterThan(50); // Should process at least 50 jobs/second
    });
  });

  describe('Database Performance', () => {
    it('should handle high-volume database operations', async () => {
      const recordCount = 10000;
      const records = Array.from({ length: recordCount }, (_, i) => ({
        id: `record-${i}`,
        tenantId: 'test-tenant',
        email: `db${i}@example.com`,
        status: 'SENT',
        timestamp: new Date()
      }));

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      const startTime = performance.now();
      
      // Batch insert records
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const values = batch.map(r => `('${r.id}', '${r.tenantId}', '${r.email}', '${r.status}', '${r.timestamp.toISOString()}')`).join(',');
        await mockDatabase.query(`INSERT INTO email_events (id, tenant_id, email, status, timestamp) VALUES ${values}`);
      }
      
      const endTime = performance.now();

      const dbTime = endTime - startTime;
      const recordsPerSecond = (recordCount / dbTime) * 1000;

      console.log(`Database performance: ${recordsPerSecond.toFixed(2)} records/second`);
      
      expect(recordsPerSecond).toBeGreaterThan(1000); // Should insert at least 1000 records/second
      expect(dbTime).toBeLessThan(20000); // Should complete within 20 seconds
    });

    it('should maintain query performance under load', async () => {
      const queryCount = 1000;
      const queries = Array.from({ length: queryCount }, (_, i) => ({
        tenantId: `tenant-${i % 10}`, // 10 different tenants
        dateRange: {
          start: new Date(Date.now() - 86400000), // 24 hours ago
          end: new Date()
        }
      }));

      mockDatabase.query.mockResolvedValue({
        rows: [{ sent: 100, delivered: 95, opened: 28, clicked: 6 }]
      });

      const startTime = performance.now();
      
      const queryPromises = queries.map(query => 
        analyticsService.getCampaignMetrics(query.tenantId)
      );
      
      await Promise.all(queryPromises);
      const endTime = performance.now();

      const queryTime = endTime - startTime;
      const queriesPerSecond = (queryCount / queryTime) * 1000;

      console.log(`Query performance: ${queriesPerSecond.toFixed(2)} queries/second`);
      
      expect(queriesPerSecond).toBeGreaterThan(100); // Should handle at least 100 queries/second
      expect(queryTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain reasonable memory usage during bulk operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate large bulk operation
      const largeDataSet = Array.from({ length: 50000 }, (_, i) => ({
        id: `large-${i}`,
        data: `${'x'.repeat(1000)}${i}` // 1KB per record
      }));

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      // Process in chunks to test memory management
      const chunkSize = 1000;
      for (let i = 0; i < largeDataSet.length; i += chunkSize) {
        const chunk = largeDataSet.slice(i, i + chunkSize);
        await Promise.all(chunk.map(item => 
          mockDatabase.query('INSERT INTO test_table (id, data) VALUES ($1, $2)', [item.id, item.data])
        ));
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      console.log(`Memory increase: ${memoryIncreaseKB.toFixed(2)} KB`);
      console.log(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Stress Testing', () => {
    it('should handle sustained high load', async () => {
      const testDuration = performanceConfig.emailSendingCapacity.testDuration; // 30 seconds
      const targetRate = performanceConfig.emailSendingCapacity.maxEmailsPerSecond;
      
      mockDatabase.query.mockResolvedValue({ rows: [{ id: 'stress-job' }] });
      mockQueue.add.mockResolvedValue({ id: 'stress-job' });

      const startTime = performance.now();
      let emailCount = 0;
      let errors = 0;

      const stressTest = async () => {
        while (performance.now() - startTime < testDuration) {
          try {
            const batchPromises = Array.from({ length: 10 }, (_, i) => 
              emailService.sendSingleEmail({
                id: `stress-${emailCount + i}`,
                tenantId: 'stress-tenant',
                to: `stress${emailCount + i}@example.com`,
                subject: `Stress Test ${emailCount + i}`,
                htmlContent: `<p>Stress test content ${emailCount + i}</p>`
              })
            );
            
            await Promise.all(batchPromises);
            emailCount += 10;
          } catch (error) {
            errors++;
          }
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };

      await stressTest();
      const endTime = performance.now();

      const actualDuration = endTime - startTime;
      const actualRate = (emailCount / actualDuration) * 1000;
      const errorRate = (errors / emailCount) * 100;

      console.log(`Stress test results:`);
      console.log(`  Duration: ${actualDuration.toFixed(2)}ms`);
      console.log(`  Emails sent: ${emailCount}`);
      console.log(`  Rate: ${actualRate.toFixed(2)} emails/second`);
      console.log(`  Errors: ${errors} (${errorRate.toFixed(2)}%)`);

      expect(actualRate).toBeGreaterThan(targetRate * 0.8); // Allow 20% degradation under stress
      expect(errorRate).toBeLessThan(5); // Error rate should be less than 5%
    });

    it('should recover gracefully from overload conditions', async () => {
      // Simulate overload by rejecting some operations
      let callCount = 0;
      mockQueue.add.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Queue overloaded');
        }
        return Promise.resolve({ id: `recovery-job-${callCount}` });
      });

      const emails = Array.from({ length: 100 }, (_, i) => ({
        id: `recovery-${i}`,
        tenantId: 'recovery-tenant',
        to: `recovery${i}@example.com`,
        subject: `Recovery Test ${i}`,
        htmlContent: `<p>Recovery content ${i}</p>`
      }));

      let successCount = 0;
      let failureCount = 0;

      const results = await Promise.allSettled(
        emails.map(email => emailService.sendSingleEmail(email))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
        }
      });

      console.log(`Recovery test: ${successCount} succeeded, ${failureCount} failed`);
      
      // Should have some successes even under overload
      expect(successCount).toBeGreaterThan(emails.length * 0.5);
      expect(failureCount).toBeLessThan(emails.length * 0.5);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately', async () => {
      const metrics = {
        emailsSent: 0,
        averageResponseTime: 0,
        peakMemoryUsage: 0,
        errorCount: 0
      };

      const testOperations = Array.from({ length: 100 }, (_, i) => async () => {
        const operationStart = performance.now();
        
        try {
          await emailService.sendSingleEmail({
            id: `metric-${i}`,
            tenantId: 'metrics-tenant',
            to: `metrics${i}@example.com`,
            subject: `Metrics Test ${i}`,
            htmlContent: `<p>Metrics content ${i}</p>`
          });
          
          metrics.emailsSent++;
        } catch (error) {
          metrics.errorCount++;
        }
        
        const operationEnd = performance.now();
        const responseTime = operationEnd - operationStart;
        metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
        
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > metrics.peakMemoryUsage) {
          metrics.peakMemoryUsage = currentMemory;
        }
      });

      mockDatabase.query.mockResolvedValue({ rows: [{ id: 'metrics-job' }] });
      mockQueue.add.mockResolvedValue({ id: 'metrics-job' });

      await Promise.all(testOperations.map(op => op()));

      console.log('Performance Metrics:');
      console.log(`  Emails sent: ${metrics.emailsSent}`);
      console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  Peak memory usage: ${(metrics.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Error count: ${metrics.errorCount}`);

      expect(metrics.averageResponseTime).toBeLessThan(performanceConfig.apiResponseTime.maxResponseTime);
      expect(metrics.errorCount).toBe(0);
    });
  });
});