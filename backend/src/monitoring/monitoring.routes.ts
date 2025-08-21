import { Router } from 'express';
import { MonitoringController } from './monitoring.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

const authMiddleware = new AuthMiddleware().authenticate;

export function createMonitoringRoutes(monitoringController: MonitoringController): Router {
  const router = Router();

  // Health check endpoints (public)
  router.get('/health', monitoringController.getHealth.bind(monitoringController));
  router.get('/health/detailed', monitoringController.getDetailedHealth.bind(monitoringController));
  router.get('/health/history', monitoringController.getHealthHistory.bind(monitoringController));

  // Metrics endpoints (require authentication)
  router.get('/metrics', authMiddleware, monitoringController.getMetrics.bind(monitoringController));
  router.get('/metrics/performance', authMiddleware, monitoringController.getPerformanceMetrics.bind(monitoringController));
  router.get('/metrics/business', authMiddleware, monitoringController.getBusinessMetrics.bind(monitoringController));
  router.get('/metrics/system', authMiddleware, monitoringController.getSystemMetrics.bind(monitoringController));

  // Alert endpoints (require authentication)
  router.get('/alerts', authMiddleware, monitoringController.getAlerts.bind(monitoringController));
  router.post('/alerts/rules', authMiddleware, monitoringController.createAlertRule.bind(monitoringController));
  router.put('/alerts/rules/:id', authMiddleware, monitoringController.updateAlertRule.bind(monitoringController));
  router.delete('/alerts/rules/:id', authMiddleware, monitoringController.deleteAlertRule.bind(monitoringController));
  router.post('/alerts/:id/resolve', authMiddleware, monitoringController.resolveAlert.bind(monitoringController));

  // Dashboard endpoints (require authentication)
  router.get('/dashboard', authMiddleware, monitoringController.getDashboardData.bind(monitoringController));
  router.get('/dashboard/uptime', authMiddleware, monitoringController.getUptimeStats.bind(monitoringController));

  return router;
}