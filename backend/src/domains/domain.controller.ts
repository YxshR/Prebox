import { Request, Response } from 'express';
import { DomainService } from './domain.service';
import { CreateDomainRequest, UpdateDomainRequest } from './domain.types';

export class DomainController {
  constructor(private domainService: DomainService) {}

  /**
   * Create a new domain for verification
   */
  async createDomain(req: any, res: Response): Promise<void> {
    try {
      const { domain } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!domain) {
        res.status(400).json({ error: 'Domain is required' });
        return;
      }

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(domain)) {
        res.status(400).json({ error: 'Invalid domain format' });
        return;
      }

      const createRequest: CreateDomainRequest = {
        domain,
        tenantId
      };

      const newDomain = await this.domainService.createDomain(createRequest);
      res.status(201).json(newDomain);
    } catch (error) {
      console.error('Error creating domain:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get domain by ID
   */
  async getDomain(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const domain = await this.domainService.getDomainById(id);
      
      if (!domain) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      // Ensure user can only access their own domains
      if (domain.tenantId !== tenantId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json(domain);
    } catch (error) {
      console.error('Error getting domain:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all domains for the authenticated user's tenant
   */
  async getDomains(req: any, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const domains = await this.domainService.getDomainsByTenant(tenantId);
      res.json(domains);
    } catch (error) {
      console.error('Error getting domains:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get domain setup wizard
   */
  async getSetupWizard(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      const wizard = await this.domainService.createSetupWizard(id);
      res.json(wizard);
    } catch (error) {
      console.error('Error getting setup wizard:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Verify domain DNS records
   */
  async verifyDomain(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      const verificationResult = await this.domainService.verifyDomain(id);
      res.json(verificationResult);
    } catch (error) {
      console.error('Error verifying domain:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get domain reputation
   */
  async getDomainReputation(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      const reputation = await this.domainService.getDomainReputation(id);
      
      if (!reputation) {
        // If no reputation exists, create one
        const newReputation = await this.domainService.updateDomainReputation(id);
        res.json(newReputation);
        return;
      }

      res.json(reputation);
    } catch (error) {
      console.error('Error getting domain reputation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update domain reputation (manual refresh)
   */
  async updateDomainReputation(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      const reputation = await this.domainService.updateDomainReputation(id);
      res.json(reputation);
    } catch (error) {
      console.error('Error updating domain reputation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get domain alerts
   */
  async getDomainAlerts(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const includeResolved = req.query.includeResolved === 'true';

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      const alerts = await this.domainService.getDomainAlerts(id, includeResolved);
      res.json(alerts);
    } catch (error) {
      console.error('Error getting domain alerts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Resolve domain alert
   */
  async resolveAlert(req: any, res: Response): Promise<void> {
    try {
      const { id, alertId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      await this.domainService.resolveAlert(alertId);
      res.json({ message: 'Alert resolved successfully' });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Monitor domain (manual trigger)
   */
  async monitorDomain(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify domain ownership
      const domain = await this.domainService.getDomainById(id);
      if (!domain || domain.tenantId !== tenantId) {
        res.status(404).json({ error: 'Domain not found' });
        return;
      }

      await this.domainService.monitorDomain(id);
      res.json({ message: 'Domain monitoring completed' });
    } catch (error) {
      console.error('Error monitoring domain:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}