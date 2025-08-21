import { Request, Response } from 'express';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';
import { HealthCheckService } from './health-check.service';
import { AlertRule } from './monitoring.types';

export class MonitoringController {
  private monitoringService: MonitoringService;
  private metricsService: MetricsService;
  private alertingService: AlertingService;
  private healthCheckService: HealthCheckService;

  constructor(
    monitoringService: MonitoringService,
    metricsService: MetricsService,
    alertingService: AlertingService,
    healthCheckService: HealthCheckService
  ) {
    this.monitoringService = monitoringService;
    this.metricsService = metricsService;
    this.alertingService = alertingService;
    this.healthCheckService = healthCheckService;
  }

  /**
   * Get basic health status
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.healthCheckService.getSystemHealth();
      
      res.status(health.overall === 'healthy' ? 200 : 503).json({
        status: health.overall,
        timestamp: health.timestamp,
        uptime: health.uptime
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: 'Failed to get health status',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get detailed health information
   */
  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.healthCheckService.getSystemHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get detailed health information',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get health check history
   */
  async getHealthHistory(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const history = await this.healthCheckService.getHealthHistory(hours);
      
      res.json({
        history,
        period: `${hours} hours`
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get health history',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get metrics data
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { name, start, end, aggregation, interval } = req.query;
      
      if (!name || !start || !end) {
        res.status(400).json({
          error: 'Missing required parameters: name, start, end'
        });
        return;
      }

      const startTime = new Date(start as string);
      const endTime = new Date(end as string);

      let metrics;
      if (aggregation) {
        metrics = await this.metricsService.getAggregatedMetrics(
          name as string,
          startTime,
          endTime,
          aggregation as any,
          (interval as any) || '5m'
        );
      } else {
        metrics = await this.metricsService.getMetrics(
          name as string,
          startTime,
          endTime
        );
      }

      res.json({
        metrics,
        name,
        period: { start: startTime, end: endTime }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metrics',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { start, end, endpoint } = req.query;
      
      if (!start || !end) {
        res.status(400).json({
          error: 'Missing required parameters: start, end'
        });
        return;
      }

      const startTime = new Date(start as string);
      const endTime = new Date(end as string);

      const [metrics, errorRate, avgResponseTime] = await Promise.all([
        this.monitoringService.getPerformanceMetrics(startTime, endTime, endpoint as string),
        this.monitoringService.getErrorRate(startTime, endTime),
        this.monitoringService.getAverageResponseTime(startTime, endTime)
      ]);

      res.json({
        metrics,
        summary: {
          errorRate,
          avgResponseTime,
          totalRequests: metrics.length
        },
        period: { start: startTime, end: endTime }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get performance metrics',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { start, end, tenantId } = req.query;
      
      if (!start || !end) {
        res.status(400).json({
          error: 'Missing required parameters: start, end'
        });
        return;
      }

      const startTime = new Date(start as string);
      const endTime = new Date(end as string);

      const summary = await this.monitoringService.getBusinessMetricsSummary(
        startTime,
        endTime,
        tenantId as string
      );

      res.json({
        summary,
        period: { start: startTime, end: endTime }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get business metrics',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const systemMetrics = await this.metricsService.getSystemMetrics();
      res.json(systemMetrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get system metrics',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get alerts
   */
  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const [activeAlerts, alertRules] = await Promise.all([
        this.alertingService.getActiveAlerts(),
        this.alertingService.getAlertRules()
      ]);

      res.json({
        activeAlerts,
        alertRules
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get alerts',
        timestamp: new Date()
      });
    }
  }

  /**
   * Create alert rule
   */
  async createAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const ruleData: Omit<AlertRule, 'id'> = req.body;
      
      // Validate required fields
      if (!ruleData.name || !ruleData.metric || !ruleData.condition || ruleData.threshold === undefined) {
        res.status(400).json({
          error: 'Missing required fields: name, metric, condition, threshold'
        });
        return;
      }

      const alertRule = await this.alertingService.createAlertRule(ruleData);
      res.status(201).json(alertRule);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create alert rule',
        timestamp: new Date()
      });
    }
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      await this.alertingService.updateAlertRule(id, updates);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update alert rule',
        timestamp: new Date()
      });
    }
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.alertingService.deleteAlertRule(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete alert rule',
        timestamp: new Date()
      });
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.alertingService.resolveAlert(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to resolve alert',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      const [
        health,
        performanceMetrics,
        businessMetrics,
        activeAlerts,
        systemMetrics
      ] = await Promise.all([
        this.healthCheckService.getSystemHealth(),
        this.monitoringService.getPerformanceMetrics(startTime, endTime),
        this.monitoringService.getBusinessMetricsSummary(startTime, endTime),
        this.alertingService.getActiveAlerts(),
        this.metricsService.getSystemMetrics()
      ]);

      // Calculate summary statistics
      const totalRequests = performanceMetrics.length;
      const errorCount = performanceMetrics.filter(m => m.statusCode >= 400).length;
      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
      const avgResponseTime = totalRequests > 0 
        ? performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
        : 0;

      res.json({
        health,
        summary: {
          totalRequests,
          errorRate: Math.round(errorRate * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime * 100) / 100,
          activeAlerts: activeAlerts.length,
          uptime: health.uptime
        },
        businessMetrics,
        systemMetrics,
        activeAlerts: activeAlerts.slice(0, 10), // Latest 10 alerts
        period: { start: startTime, end: endTime, hours }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get dashboard data',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get uptime statistics
   */
  async getUptimeStats(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const stats = await this.healthCheckService.getUptimeStats(days);
      
      res.json({
        ...stats,
        period: `${days} days`
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get uptime statistics',
        timestamp: new Date()
      });
    }
  }
}