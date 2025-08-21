import { Pool } from 'pg';
import { DomainService } from './domain.service';
import { DomainStatus, DNSRecordType, AlertType, AlertSeverity } from './domain.types';

// Mock the dns module
jest.mock('dns', () => ({
  resolveTxt: jest.fn(),
  resolveCname: jest.fn(),
  resolveMx: jest.fn()
}));

// Mock the database
const mockDb = {
  query: jest.fn()
} as unknown as Pool;

describe('DomainService', () => {
  let domainService: DomainService;

  beforeEach(() => {
    domainService = new DomainService(mockDb);
    jest.clearAllMocks();
  });

  describe('createDomain', () => {
    it('should create a new domain with verification records', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'tenant-id',
        domain: 'example.com',
        status: DomainStatus.PENDING,
        dkim_key: 'mock-dkim-key',
        verification_records: JSON.stringify([]),
        verified_at: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [mockDomainRow]
      });

      const request = {
        domain: 'example.com',
        tenantId: 'tenant-id'
      };

      const result = await domainService.createDomain(request);

      expect(result.domain).toBe('example.com');
      expect(result.tenantId).toBe('tenant-id');
      expect(result.status).toBe(DomainStatus.PENDING);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO domains'),
        expect.arrayContaining(['tenant-id', 'example.com'])
      );
    });
  });

  describe('generateVerificationRecords', () => {
    it('should generate SPF, DKIM, DMARC, and verification records', () => {
      const domain = 'example.com';
      const dkimKey = 'mock-dkim-key';

      const records = domainService.generateVerificationRecords(domain, dkimKey);

      expect(records).toHaveLength(4);
      
      // Check SPF record
      const spfRecord = records.find(r => r.value.includes('v=spf1'));
      expect(spfRecord).toBeDefined();
      expect(spfRecord?.type).toBe(DNSRecordType.TXT);
      expect(spfRecord?.name).toBe(domain);

      // Check DKIM record
      const dkimRecord = records.find(r => r.value.includes('v=DKIM1'));
      expect(dkimRecord).toBeDefined();
      expect(dkimRecord?.type).toBe(DNSRecordType.TXT);
      expect(dkimRecord?.name).toBe(`mail._domainkey.${domain}`);

      // Check DMARC record
      const dmarcRecord = records.find(r => r.value.includes('v=DMARC1'));
      expect(dmarcRecord).toBeDefined();
      expect(dmarcRecord?.type).toBe(DNSRecordType.TXT);
      expect(dmarcRecord?.name).toBe(`_dmarc.${domain}`);

      // Check verification record
      const verificationRecord = records.find(r => r.value.includes('bulk-email-platform-verification'));
      expect(verificationRecord).toBeDefined();
      expect(verificationRecord?.type).toBe(DNSRecordType.TXT);
      expect(verificationRecord?.name).toBe(`_verification.${domain}`);
    });
  });

  describe('getDomainById', () => {
    it('should return domain when found', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'tenant-id',
        domain: 'example.com',
        status: DomainStatus.VERIFIED,
        dkim_key: 'mock-dkim-key',
        verification_records: JSON.stringify([]),
        verified_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [mockDomainRow]
      });

      const result = await domainService.getDomainById('domain-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('domain-id');
      expect(result?.domain).toBe('example.com');
      expect(result?.status).toBe(DomainStatus.VERIFIED);
    });

    it('should return null when domain not found', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: []
      });

      const result = await domainService.getDomainById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getDomainsByTenant', () => {
    it('should return all domains for a tenant', async () => {
      const mockDomainRows = [
        {
          id: 'domain-1',
          tenant_id: 'tenant-id',
          domain: 'example1.com',
          status: DomainStatus.VERIFIED,
          dkim_key: 'mock-dkim-key-1',
          verification_records: JSON.stringify([]),
          verified_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'domain-2',
          tenant_id: 'tenant-id',
          domain: 'example2.com',
          status: DomainStatus.PENDING,
          dkim_key: 'mock-dkim-key-2',
          verification_records: JSON.stringify([]),
          verified_at: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: mockDomainRows
      });

      const result = await domainService.getDomainsByTenant('tenant-id');

      expect(result).toHaveLength(2);
      expect(result[0].domain).toBe('example1.com');
      expect(result[1].domain).toBe('example2.com');
    });
  });

  describe('createSetupWizard', () => {
    it('should create setup wizard with instructions', async () => {
      const mockDomain = {
        id: 'domain-id',
        tenantId: 'tenant-id',
        domain: 'example.com',
        status: DomainStatus.PENDING,
        dkimKey: 'mock-dkim-key',
        verificationRecords: [
          {
            type: DNSRecordType.TXT,
            name: 'example.com',
            value: 'v=spf1 include:amazonses.com ~all',
            ttl: 300
          },
          {
            type: DNSRecordType.TXT,
            name: 'mail._domainkey.example.com',
            value: 'v=DKIM1; k=rsa; p=mock-dkim-key',
            ttl: 300
          },
          {
            type: DNSRecordType.TXT,
            name: '_dmarc.example.com',
            value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com',
            ttl: 300
          },
          {
            type: DNSRecordType.TXT,
            name: '_verification.example.com',
            value: 'bulk-email-platform-verification=test-token',
            ttl: 300
          }
        ],
        verifiedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(domainService, 'getDomainById').mockResolvedValue(mockDomain);

      const result = await domainService.createSetupWizard('domain-id');

      expect(result.domain).toBe('example.com');
      expect(result.instructions.steps).toHaveLength(4);
      expect(result.instructions.steps[0].title).toBe('Add SPF Record');
      expect(result.instructions.steps[1].title).toBe('Add DKIM Record');
      expect(result.instructions.steps[2].title).toBe('Add DMARC Record');
      expect(result.instructions.steps[3].title).toBe('Add Verification Record');
    });

    it('should throw error when domain not found', async () => {
      jest.spyOn(domainService, 'getDomainById').mockResolvedValue(null);

      await expect(domainService.createSetupWizard('non-existent-id'))
        .rejects.toThrow('Domain not found');
    });
  });

  describe('updateDomainReputation', () => {
    it('should calculate and update domain reputation', async () => {
      const mockDomain = {
        id: 'domain-id',
        tenantId: 'tenant-id',
        domain: 'example.com',
        status: DomainStatus.VERIFIED,
        dkimKey: 'mock-dkim-key',
        verificationRecords: [],
        verifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(domainService, 'getDomainById').mockResolvedValue(mockDomain);
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'reputation-id' }]
      });

      const result = await domainService.updateDomainReputation('domain-id');

      expect(result.domain).toBe('example.com');
      expect(result.score).toBeGreaterThan(0);
      expect(result.factors).toHaveLength(3);
      expect(result.factors[0].name).toBe('DNS Authentication');
      expect(result.factors[1].name).toBe('Sending History');
      expect(result.factors[2].name).toBe('Complaint Rate');
    });
  });

  describe('createAlert', () => {
    it('should create a domain alert', async () => {
      const mockAlertRow = {
        id: 'alert-id',
        domain_id: 'domain-id',
        type: AlertType.VERIFICATION_FAILED,
        severity: AlertSeverity.HIGH,
        message: 'Test alert message',
        details: JSON.stringify({}),
        is_resolved: false,
        created_at: new Date(),
        resolved_at: null
      };

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [mockAlertRow]
      });

      const result = await domainService.createAlert(
        'domain-id',
        AlertType.VERIFICATION_FAILED,
        AlertSeverity.HIGH,
        'Test alert message'
      );

      expect(result.domainId).toBe('domain-id');
      expect(result.type).toBe(AlertType.VERIFICATION_FAILED);
      expect(result.severity).toBe(AlertSeverity.HIGH);
      expect(result.message).toBe('Test alert message');
      expect(result.isResolved).toBe(false);
    });
  });

  describe('getDomainAlerts', () => {
    it('should return unresolved alerts by default', async () => {
      const mockAlertRows = [
        {
          id: 'alert-1',
          domain_id: 'domain-id',
          type: AlertType.VERIFICATION_FAILED,
          severity: AlertSeverity.HIGH,
          message: 'Alert 1',
          details: JSON.stringify({}),
          is_resolved: false,
          created_at: new Date(),
          resolved_at: null
        }
      ];

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: mockAlertRows
      });

      const result = await domainService.getDomainAlerts('domain-id');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Alert 1');
      expect(result[0].isResolved).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('is_resolved = FALSE'),
        ['domain-id']
      );
    });

    it('should return all alerts when includeResolved is true', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: []
      });

      await domainService.getDomainAlerts('domain-id', true);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.not.stringContaining('is_resolved = FALSE'),
        ['domain-id']
      );
    });
  });

  describe('resolveAlert', () => {
    it('should mark alert as resolved', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: []
      });

      await domainService.resolveAlert('alert-id');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE domain_alerts'),
        ['alert-id']
      );
    });
  });
});