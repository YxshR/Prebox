import request from 'supertest';
import { Pool } from 'pg';
import express from 'express';
import { createDomainRoutes } from './domain.routes';
import { DomainStatus } from './domain.types';

// Mock database for integration tests
const mockDb = {
  query: jest.fn()
} as unknown as Pool;

// Mock the AuthMiddleware class
jest.mock('../auth/auth.middleware', () => ({
  AuthMiddleware: jest.fn().mockImplementation(() => ({
    authenticate: (req: any, res: any, next: any) => {
      req.user = { tenantId: 'test-tenant-id' };
      next();
    }
  }))
}));

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/domains', createDomainRoutes(mockDb));
  return app;
};

describe('Domain API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('POST /api/domains', () => {
    it('should create a new domain', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'test-tenant-id',
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

      const response = await request(app)
        .post('/api/domains')
        .send({ domain: 'example.com' })
        .expect(201);

      expect(response.body.domain).toBe('example.com');
      expect(response.body.status).toBe(DomainStatus.PENDING);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO domains'),
        expect.arrayContaining(['test-tenant-id', 'example.com'])
      );
    });

    it('should return 400 for invalid domain', async () => {
      const response = await request(app)
        .post('/api/domains')
        .send({ domain: 'invalid-domain' })
        .expect(400);

      expect(response.body.error).toBe('Invalid domain format');
    });

    it('should return 400 for missing domain', async () => {
      const response = await request(app)
        .post('/api/domains')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Domain is required');
    });
  });

  describe('GET /api/domains', () => {
    it('should return user domains', async () => {
      const mockDomainRows = [
        {
          id: 'domain-1',
          tenant_id: 'test-tenant-id',
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
          tenant_id: 'test-tenant-id',
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

      const response = await request(app)
        .get('/api/domains')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].domain).toBe('example1.com');
      expect(response.body[1].domain).toBe('example2.com');
    });
  });

  describe('GET /api/domains/:id', () => {
    it('should return domain by id', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'test-tenant-id',
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

      const response = await request(app)
        .get('/api/domains/domain-id')
        .expect(200);

      expect(response.body.id).toBe('domain-id');
      expect(response.body.domain).toBe('example.com');
    });

    it('should return 404 for non-existent domain', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: []
      });

      await request(app)
        .get('/api/domains/non-existent-id')
        .expect(404);
    });

    it('should return 403 for domain owned by different tenant', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'different-tenant-id',
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

      await request(app)
        .get('/api/domains/domain-id')
        .expect(403);
    });
  });

  describe('GET /api/domains/:id/setup-wizard', () => {
    it('should return setup wizard instructions', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'test-tenant-id',
        domain: 'example.com',
        status: DomainStatus.PENDING,
        dkim_key: 'mock-dkim-key',
        verification_records: JSON.stringify([
          {
            type: 'TXT',
            name: 'example.com',
            value: 'v=spf1 include:amazonses.com ~all',
            ttl: 300
          },
          {
            type: 'TXT',
            name: 'mail._domainkey.example.com',
            value: 'v=DKIM1; k=rsa; p=mock-dkim-key',
            ttl: 300
          },
          {
            type: 'TXT',
            name: '_dmarc.example.com',
            value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com',
            ttl: 300
          },
          {
            type: 'TXT',
            name: '_verification.example.com',
            value: 'bulk-email-platform-verification=test-token',
            ttl: 300
          }
        ]),
        verified_at: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [mockDomainRow]
      });

      const response = await request(app)
        .get('/api/domains/domain-id/setup-wizard')
        .expect(200);

      expect(response.body.domain).toBe('example.com');
      expect(response.body.instructions.steps).toHaveLength(4);
      expect(response.body.spfRecord).toBeDefined();
      expect(response.body.dkimRecord).toBeDefined();
      expect(response.body.dmarcRecord).toBeDefined();
      expect(response.body.verificationRecord).toBeDefined();
    });
  });

  describe('POST /api/domains/:id/verify', () => {
    it('should verify domain DNS records', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'test-tenant-id',
        domain: 'example.com',
        status: DomainStatus.PENDING,
        dkim_key: 'mock-dkim-key',
        verification_records: JSON.stringify([]),
        verified_at: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock multiple database calls for verification process
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDomainRow] }) // getDomainById
        .mockResolvedValueOnce({ rows: [] }) // updateDomainStatus
        .mockResolvedValueOnce({ rows: [] }) // markDomainAsVerified or createAlert
        .mockResolvedValueOnce({ rows: [] }); // additional queries

      const response = await request(app)
        .post('/api/domains/domain-id/verify')
        .expect(200);

      expect(response.body.domain).toBe('example.com');
      expect(response.body).toHaveProperty('isVerified');
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/domains/:id/reputation', () => {
    it('should return domain reputation', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'test-tenant-id',
        domain: 'example.com',
        status: DomainStatus.VERIFIED,
        dkim_key: 'mock-dkim-key',
        verification_records: JSON.stringify([]),
        verified_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockReputationRow = {
        domain: 'example.com',
        score: 85,
        factors: JSON.stringify([]),
        last_updated: new Date(),
        recommendations: JSON.stringify([])
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDomainRow] }) // getDomainById
        .mockResolvedValueOnce({ rows: [mockReputationRow] }); // getDomainReputation

      const response = await request(app)
        .get('/api/domains/domain-id/reputation')
        .expect(200);

      expect(response.body.domain).toBe('example.com');
      expect(response.body.score).toBe(85);
    });
  });

  describe('GET /api/domains/:id/alerts', () => {
    it('should return domain alerts', async () => {
      const mockDomainRow = {
        id: 'domain-id',
        tenant_id: 'test-tenant-id',
        domain: 'example.com',
        status: DomainStatus.VERIFIED,
        dkim_key: 'mock-dkim-key',
        verification_records: JSON.stringify([]),
        verified_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockAlertRows = [
        {
          id: 'alert-1',
          domain_id: 'domain-id',
          type: 'verification_failed',
          severity: 'high',
          message: 'DNS verification failed',
          details: JSON.stringify({}),
          is_resolved: false,
          created_at: new Date(),
          resolved_at: null
        }
      ];

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDomainRow] }) // getDomainById
        .mockResolvedValueOnce({ rows: mockAlertRows }); // getDomainAlerts

      const response = await request(app)
        .get('/api/domains/domain-id/alerts')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].message).toBe('DNS verification failed');
      expect(response.body[0].isResolved).toBe(false);
    });
  });
});