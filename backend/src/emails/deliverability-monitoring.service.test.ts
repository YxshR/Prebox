import { Pool } from 'pg';
import { DeliverabilityMonitoringService, SpamScoreResult, AuthenticationResult } from './deliverability-monitoring.service';
import { DomainService } from '../domains/domain.service';

// Mock the database and domain service
jest.mock('pg');
jest.mock('../domains/domain.service');

describe('DeliverabilityMonitoringService', () => {
    let service: DeliverabilityMonitoringService;
    let mockDb: any;
    let mockDomainService: any;

    beforeEach(() => {
        mockDb = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
        };

        mockDomainService = {
            getDomainById: jest.fn(),
            verifyDomain: jest.fn(),
            updateDomainReputation: jest.fn(),
            createAlert: jest.fn(),
        };

        service = new DeliverabilityMonitoringService(mockDb, mockDomainService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        service.stopMonitoring();
    });

    describe('getDeliverabilityMetrics', () => {
        it('should calculate deliverability metrics correctly', async () => {
            const mockQueryResult = {
                rows: [{
                    total_emails: '1000',
                    sent: '950',
                    delivered: '900',
                    bounced: '30',
                    complained: '2',
                    opened: '250',
                    clicked: '50',
                    unsubscribed: '5'
                }]
            };

            mockDb.query.mockResolvedValue(mockQueryResult);

            const result = await service.getDeliverabilityMetrics('tenant-123', 7);

            expect(result).toEqual({
                deliveryRate: 95, // 900/950 * 100
                bounceRate: 3,    // 30/950 * 100
                complaintRate: 0.21, // 2/950 * 100
                openRate: 28,     // 250/900 * 100
                clickRate: 6,     // 50/900 * 100
                spamRate: 0.32,   // (2 + 30*0.3)/950 * 100
                unsubscribeRate: 0.56, // 5/900 * 100
                reputationScore: expect.any(Number),
                authenticationScore: expect.any(Number)
            });

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM email_events'),
                ['tenant-123']
            );
        });

        it('should handle zero emails gracefully', async () => {
            const mockQueryResult = {
                rows: [{
                    total_emails: '0',
                    sent: '0',
                    delivered: '0',
                    bounced: '0',
                    complained: '0',
                    opened: '0',
                    clicked: '0',
                    unsubscribed: '0'
                }]
            };

            mockDb.query.mockResolvedValue(mockQueryResult);

            const result = await service.getDeliverabilityMetrics('tenant-123', 7);

            expect(result.deliveryRate).toBe(0);
            expect(result.bounceRate).toBe(0);
            expect(result.complaintRate).toBe(0);
        });
    });

    describe('analyzeSpamScore', () => {
        it('should detect spam indicators in subject line', async () => {
            const emailContent = {
                subject: 'FREE URGENT ACT NOW!!!',
                htmlContent: '<p>This is a test email</p>',
                fromEmail: 'test@example.com'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.score).toBeGreaterThan(0);
            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Excessive Capitalization'
                    }),
                    expect.objectContaining({
                        name: 'Spam Keywords'
                    }),
                    expect.objectContaining({
                        name: 'Excessive Punctuation'
                    })
                ])
            );
            expect(result.recommendations).toContain('Use normal capitalization in subject lines');
            expect(result.recommendations).toContain('Avoid using promotional keywords in subject lines');
        });

        it('should detect excessive links in content', async () => {
            const emailContent = {
                subject: 'Newsletter',
                htmlContent: `
          <p>Short content</p>
          <a href="http://example.com">Link 1</a>
          <a href="http://example.com">Link 2</a>
          <a href="http://example.com">Link 3</a>
          <a href="http://example.com">Link 4</a>
        `,
                fromEmail: 'newsletter@example.com'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Excessive Links'
                    })
                ])
            );
            expect(result.recommendations).toContain('Reduce the number of links in your email content');
        });

        it('should detect image-heavy content', async () => {
            const emailContent = {
                subject: 'Images',
                htmlContent: '<img src="test1.jpg"><img src="test2.jpg"><p>Hi</p>',
                fromEmail: 'test@example.com'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Image-Heavy Content'
                    })
                ])
            );
            expect(result.recommendations).toContain('Include more text content alongside images');
        });

        it('should return low score for clean content', async () => {
            const emailContent = {
                subject: 'Monthly Newsletter',
                htmlContent: `
          <p>Dear subscriber,</p>
          <p>Here is our monthly newsletter with updates about our company and industry news.</p>
          <p>We hope you find this information valuable.</p>
          <p>Best regards,<br>The Team</p>
        `,
                textContent: 'Dear subscriber, Here is our monthly newsletter...',
                fromEmail: 'newsletter@company.com',
                fromName: 'Company Newsletter'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.score).toBeLessThan(20);
            expect(result.isLikelySpam).toBe(false);
        });
    });

    describe('validateEmailAuthentication', () => {
        it('should validate SPF, DKIM, and DMARC records', async () => {
            const result = await service.validateEmailAuthentication('example.com');

            expect(result).toEqual({
                spf: expect.objectContaining({
                    isValid: expect.any(Boolean),
                    score: expect.any(Number),
                    details: expect.any(String)
                }),
                dkim: expect.objectContaining({
                    isValid: expect.any(Boolean),
                    score: expect.any(Number),
                    details: expect.any(String)
                }),
                dmarc: expect.objectContaining({
                    isValid: expect.any(Boolean),
                    score: expect.any(Number),
                    details: expect.any(String)
                }),
                overallScore: expect.any(Number),
                isValid: expect.any(Boolean)
            });
        });

        it('should calculate overall score correctly', async () => {
            // Mock the private methods to return predictable results
            const spyCheckSPF = jest.spyOn(service as any, 'checkSPF').mockResolvedValue({
                isValid: true,
                score: 100,
                details: 'SPF record is properly configured'
            });

            const spyCheckDKIM = jest.spyOn(service as any, 'checkDKIM').mockResolvedValue({
                isValid: true,
                score: 100,
                details: 'DKIM signature is properly configured'
            });

            const spyCheckDMARC = jest.spyOn(service as any, 'checkDMARC').mockResolvedValue({
                isValid: true,
                score: 100,
                details: 'DMARC policy is properly configured'
            });

            const result = await service.validateEmailAuthentication('example.com');

            expect(result.overallScore).toBe(100);
            expect(result.isValid).toBe(true);

            spyCheckSPF.mockRestore();
            spyCheckDKIM.mockRestore();
            spyCheckDMARC.mockRestore();
        });
    });

    describe('monitorSenderReputation', () => {
        it('should calculate reputation metrics', async () => {
            // Mock deliverability metrics
            const mockMetrics = {
                deliveryRate: 95,
                bounceRate: 3,
                complaintRate: 0.1,
                openRate: 25,
                clickRate: 5,
                spamRate: 0.5,
                unsubscribeRate: 0.2,
                reputationScore: 85,
                authenticationScore: 90
            };

            jest.spyOn(service, 'getDeliverabilityMetrics').mockResolvedValue(mockMetrics);

            // Mock historical data
            const mockHistoricalData = [mockMetrics, mockMetrics, mockMetrics];
            jest.spyOn(service as any, 'getHistoricalMetrics').mockResolvedValue(mockHistoricalData);

            // Mock domain queries
            mockDb.query.mockResolvedValue({ rows: [{ id: 'domain-1', domain: 'example.com' }] });

            const result = await service.monitorSenderReputation('tenant-123');

            expect(result).toEqual({
                senderScore: expect.any(Number),
                domainScore: expect.any(Number),
                ipScore: expect.any(Number),
                overallScore: expect.any(Number),
                factors: expect.any(Array),
                trend: expect.stringMatching(/improving|stable|declining/)
            });

            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Delivery Rate',
                        impact: expect.any(Number),
                        status: expect.stringMatching(/good|warning|critical/)
                    })
                ])
            );
        });
    });

    describe('optimizeDeliveryRates', () => {
        it('should provide optimization recommendations', async () => {
            // Mock all required methods
            const mockMetrics = {
                deliveryRate: 85, // Below threshold
                bounceRate: 8,    // Above threshold
                complaintRate: 0.3,
                openRate: 15,
                clickRate: 2,
                spamRate: 1.0,
                unsubscribeRate: 0.5,
                reputationScore: 70,
                authenticationScore: 60
            };

            const mockAuthResult = {
                spf: { isValid: false, score: 50, details: 'SPF issues' },
                dkim: { isValid: false, score: 40, details: 'DKIM issues' },
                dmarc: { isValid: false, score: 30, details: 'DMARC issues' },
                overallScore: 40,
                isValid: false
            };

            const mockReputationMetrics = {
                senderScore: 70,
                domainScore: 65,
                ipScore: 75,
                overallScore: 70,
                factors: [],
                trend: 'declining' as const
            };

            jest.spyOn(service, 'getDeliverabilityMetrics').mockResolvedValue(mockMetrics);
            jest.spyOn(service as any, 'validateTenantAuthentication').mockResolvedValue(mockAuthResult);
            jest.spyOn(service, 'monitorSenderReputation').mockResolvedValue(mockReputationMetrics);

            const result = await service.optimizeDeliveryRates('tenant-123');

            expect(result.currentMetrics).toEqual(mockMetrics);
            expect(result.recommendations).toContain('Improve email authentication setup');
            expect(result.optimizationActions).toContain('Fix SPF, DKIM, and DMARC records');
            expect(result.estimatedImprovement).toBeGreaterThan(0);
        });
    });

    describe('monitoring lifecycle', () => {
        it('should start and stop monitoring', () => {
            expect(service.stopMonitoring).not.toThrow();

            service.startMonitoring(1); // 1 minute for testing
            expect(service.stopMonitoring).not.toThrow();
        });

        it('should handle monitoring cycle errors gracefully', async () => {
            mockDb.query.mockRejectedValue(new Error('Database error'));

            // Should not throw
            await expect(service.runMonitoringCycle()).resolves.not.toThrow();
        });
    });

    describe('alert creation', () => {
        it('should create alerts for high bounce rates', async () => {
            const mockMetrics = {
                deliveryRate: 95,
                bounceRate: 12, // Above critical threshold
                complaintRate: 0.1,
                openRate: 25,
                clickRate: 5,
                spamRate: 0.5,
                unsubscribeRate: 0.2,
                reputationScore: 85,
                authenticationScore: 90
            };

            jest.spyOn(service, 'getDeliverabilityMetrics').mockResolvedValue(mockMetrics);
            mockDb.query.mockResolvedValue({ rows: [] }); // Mock alert creation

            await service.monitorTenantDeliverability('tenant-123');

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO deliverability_alerts'),
                expect.arrayContaining(['tenant-123', 'high_bounce_rate'])
            );
        });

        it('should create alerts for low delivery rates', async () => {
            const mockMetrics = {
                deliveryRate: 85, // Below critical threshold
                bounceRate: 3,
                complaintRate: 0.1,
                openRate: 25,
                clickRate: 5,
                spamRate: 0.5,
                unsubscribeRate: 0.2,
                reputationScore: 85,
                authenticationScore: 90
            };

            jest.spyOn(service, 'getDeliverabilityMetrics').mockResolvedValue(mockMetrics);
            mockDb.query.mockResolvedValue({ rows: [] });

            await service.monitorTenantDeliverability('tenant-123');

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO deliverability_alerts'),
                expect.arrayContaining(['tenant-123', 'low_delivery_rate'])
            );
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            mockDb.query.mockRejectedValue(new Error('Database connection failed'));

            await expect(service.getDeliverabilityMetrics('tenant-123')).rejects.toThrow();
        });

        it('should handle authentication validation errors', async () => {
            // Mock DNS lookup failure
            jest.spyOn(service as any, 'checkSPF').mockRejectedValue(new Error('DNS lookup failed'));

            await expect(service.validateEmailAuthentication('invalid-domain.com')).rejects.toThrow();
        });
    });

    describe('spam analysis edge cases', () => {
        it('should handle empty content', async () => {
            const emailContent = {
                subject: '',
                htmlContent: '',
                fromEmail: 'test@example.com'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Very Short Content'
                    })
                ])
            );
        });

        it('should handle no-reply senders', async () => {
            const emailContent = {
                subject: 'Test',
                htmlContent: '<p>Test content</p>',
                fromEmail: 'noreply@example.com'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'No-Reply Sender'
                    })
                ])
            );
        });

        it('should detect sender name mismatch', async () => {
            const emailContent = {
                subject: 'Test',
                htmlContent: '<p>Test content</p>',
                fromEmail: 'test@example.com',
                fromName: 'Completely Different Company'
            };

            const result = await service.analyzeSpamScore(emailContent);

            expect(result.factors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Sender Mismatch'
                    })
                ])
            );
        });
    });
});