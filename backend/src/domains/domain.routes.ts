import { Router } from 'express';
import { Pool } from 'pg';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
import { AuthMiddleware } from '../auth/auth.middleware';

const authMiddleware = new AuthMiddleware().authenticate;

export function createDomainRoutes(db: Pool): Router {
  const router = Router();
  const domainService = new DomainService(db);
  const domainController = new DomainController(domainService);

  // Apply authentication middleware to all routes
  router.use(authMiddleware);

  // Domain management routes
  router.post('/', (req, res) => domainController.createDomain(req, res));
  router.get('/', (req, res) => domainController.getDomains(req, res));
  router.get('/:id', (req, res) => domainController.getDomain(req, res));

  // Domain setup and verification routes
  router.get('/:id/setup-wizard', (req, res) => domainController.getSetupWizard(req, res));
  router.post('/:id/verify', (req, res) => domainController.verifyDomain(req, res));

  // Domain reputation routes
  router.get('/:id/reputation', (req, res) => domainController.getDomainReputation(req, res));
  router.post('/:id/reputation/refresh', (req, res) => domainController.updateDomainReputation(req, res));

  // Domain alerts routes
  router.get('/:id/alerts', (req, res) => domainController.getDomainAlerts(req, res));
  router.post('/:id/alerts/:alertId/resolve', (req, res) => domainController.resolveAlert(req, res));

  // Domain monitoring routes
  router.post('/:id/monitor', (req, res) => domainController.monitorDomain(req, res));

  return router;
}