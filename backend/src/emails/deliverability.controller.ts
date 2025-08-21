import { Request, Response } from 'express';
import { Pool } from 'pg';
import { DeliverabilityMonitoringService } from './deliverability-monitoring.service';
import { DomainService } from '../domains/domain.service';

export class DeliverabilityController {
  private deliverabilityService: DeliverabilityMonitoringService;

  constructor(private db: Pool) {
    const domainService = new DomainService(db);
    this.deliverabilityService = new DeliverabilityMonitoringService(db, domainService);
  }

  /**
   * Get deliverability metrics for a tenant
   */
  async getDeliverabilityMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;
      const { days = 7 } = req.query;

      if (!tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'Tenant ID is required'
          }
        });
        return;
      }

      const metrics = await this.deliverabilityService.getDeliverabilityMetrics(
        tenantId,
        parseInt(days as string)
      );

      res.json({
        success: true,
        data: {
          tenantId,
          period: `${days} days`,
          metrics
        }
      });
    } catch (error) {
      console.error('Error getting deliverability metrics:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get deliverability metrics'
        }
      });
    }
  }

  /**
   * Validate email authentication for a domain
   */
  async validateAuthentication(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;

      if (!domain) {
        res.status(400).json({
          error: {
            code: 'MISSING_DOMAIN',
            message: 'Domain is required'
          }
        });
        return;
      }

      const authResult = await this.deliverabilityService.validateEmailAuthentication(domain);

      res.json({
        success: true,
        data: {
          domain,
          authentication: authResult,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error validating authentication:', error);
      res.status(500).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate email authentication'
        }
      });
    }
  }

  /**
   * Analyze spam score for email content
   */
  async analyzeSpamScore(req: Request, res: Response): Promise<void> {
    try {
      const { subject, htmlContent, textContent, fromEmail, fromName } = req.body;

      if (!subject || !htmlContent || !fromEmail) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Subject, HTML content, and from email are required'
          }
        });
        return;
      }

      const spamResult = await this.deliverabilityService.analyzeSpamScore({
        subject,
        htmlContent,
        textContent,
        fromEmail,
        fromName
      });

      res.json({
        success: true,
        data: {
          spamAnalysis: spamResult,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error analyzing spam score:', error);
      res.status(500).json({
        error: {
          code: 'ANALYSIS_ERROR',
          message: 'Failed to analyze spam score'
        }
      });
    }
  }

  /**
   * Monitor sender reputation for a tenant
   */
  async monitorReputation(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'Tenant ID is required'
          }
        });
        return;
      }

      const reputationMetrics = await this.deliverabilityService.monitorSenderReputation(tenantId);

      res.json({
        success: true,
        data: {
          tenantId,
          reputation: reputationMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error monitoring reputation:', error);
      res.status(500).json({
        error: {
          code: 'MONITORING_ERROR',
          message: 'Failed to monitor sender reputation'
        }
      });
    }
  }

  /**
   * Get delivery rate optimization recommendations
   */
  async getOptimizationRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'Tenant ID is required'
          }
        });
        return;
      }

      const optimization = await this.deliverabilityService.optimizeDeliveryRates(tenantId);

      res.json({
        success: true,
        data: {
          tenantId,
          optimization,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting optimization recommendations:', error);
      res.status(500).json({
        error: {
          code: 'OPTIMIZATION_ERROR',
          message: 'Failed to get optimization recommendations'
        }
      });
    }
  }

  /**
   * Get deliverability alerts for a tenant
   */
  async getDeliverabilityAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;
      const { limit = 50, offset = 0, severity, resolved } = req.query;

      if (!tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'Tenant ID is required'
          }
        });
        return;
      }

      let query = `
        SELECT id, type, severity, message, metrics, recommendations, 
               is_resolved, created_at, resolved_at
        FROM deliverability_alerts 
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramIndex = 2;

      // Add severity filter
      if (severity) {
        query += ` AND severity = $${paramIndex}`;
        params.push(severity);
        paramIndex++;
      }

      // Add resolved filter
      if (resolved !== undefined) {
        query += ` AND is_resolved = $${paramIndex}`;
        params.push(resolved === 'true');
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await this.db.query(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM deliverability_alerts 
        WHERE tenant_id = $1
      `;
      const countParams: any[] = [tenantId];
      let countParamIndex = 2;

      if (severity) {
        countQuery += ` AND severity = $${countParamIndex}`;
        countParams.push(severity);
        countParamIndex++;
      }

      if (resolved !== undefined) {
        countQuery += ` AND is_resolved = $${countParamIndex}`;
        countParams.push(resolved === 'true');
      }

      const countResult = await this.db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      res.json({
        success: true,
        data: {
          alerts: result.rows.map(row => ({
            ...row,
            metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
            recommendations: typeof row.recommendations === 'string' ? JSON.parse(row.recommendations) : row.recommendations
          })),
          pagination: {
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: (parseInt(offset as string) + parseInt(limit as string)) < total
          }
        }
      });
    } catch (error) {
      console.error('Error getting deliverability alerts:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to get deliverability alerts'
        }
      });
    }
  }

  /**
   * Resolve a deliverability alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { tenantId } = req.body;

      if (!alertId || !tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Alert ID and tenant ID are required'
          }
        });
        return;
      }

      const query = `
        UPDATE deliverability_alerts 
        SET is_resolved = TRUE, resolved_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, is_resolved, resolved_at
      `;

      const result = await this.db.query(query, [alertId, tenantId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          error: {
            code: 'ALERT_NOT_FOUND',
            message: 'Alert not found or access denied'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          alertId,
          resolved: true,
          resolvedAt: result.rows[0].resolved_at
        }
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        error: {
          code: 'RESOLVE_ERROR',
          message: 'Failed to resolve alert'
        }
      });
    }
  }

  /**
   * Get deliverability dashboard summary
   */
  async getDashboardSummary(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;
      const { days = 7 } = req.query;

      if (!tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'Tenant ID is required'
          }
        });
        return;
      }

      // Get current metrics
      const metrics = await this.deliverabilityService.getDeliverabilityMetrics(
        tenantId,
        parseInt(days as string)
      );

      // Get recent alerts
      const alertsQuery = `
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
               COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
               COUNT(CASE WHEN is_resolved = FALSE THEN 1 END) as unresolved
        FROM deliverability_alerts 
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '${parseInt(days as string)} days'
      `;

      const alertsResult = await this.db.query(alertsQuery, [tenantId]);
      const alertsSummary = alertsResult.rows[0];

      // Get reputation trend
      const reputation = await this.deliverabilityService.monitorSenderReputation(tenantId);

      // Get optimization recommendations
      const optimization = await this.deliverabilityService.optimizeDeliveryRates(tenantId);

      res.json({
        success: true,
        data: {
          tenantId,
          period: `${days} days`,
          summary: {
            metrics,
            alerts: {
              total: parseInt(alertsSummary.total),
              critical: parseInt(alertsSummary.critical),
              high: parseInt(alertsSummary.high),
              unresolved: parseInt(alertsSummary.unresolved)
            },
            reputation,
            optimization: {
              estimatedImprovement: optimization.estimatedImprovement,
              topRecommendations: optimization.recommendations.slice(0, 3)
            }
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      res.status(500).json({
        error: {
          code: 'DASHBOARD_ERROR',
          message: 'Failed to get dashboard summary'
        }
      });
    }
  }

  /**
   * Start deliverability monitoring
   */
  async startMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const { intervalMinutes = 30 } = req.body;

      this.deliverabilityService.startMonitoring(intervalMinutes);

      res.json({
        success: true,
        data: {
          message: 'Deliverability monitoring started',
          intervalMinutes,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error starting monitoring:', error);
      res.status(500).json({
        error: {
          code: 'START_ERROR',
          message: 'Failed to start deliverability monitoring'
        }
      });
    }
  }

  /**
   * Stop deliverability monitoring
   */
  async stopMonitoring(req: Request, res: Response): Promise<void> {
    try {
      this.deliverabilityService.stopMonitoring();

      res.json({
        success: true,
        data: {
          message: 'Deliverability monitoring stopped',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      res.status(500).json({
        error: {
          code: 'STOP_ERROR',
          message: 'Failed to stop deliverability monitoring'
        }
      });
    }
  }

  /**
   * Run manual deliverability check for a tenant
   */
  async runManualCheck(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TENANT_ID',
            message: 'Tenant ID is required'
          }
        });
        return;
      }

      await this.deliverabilityService.monitorTenantDeliverability(tenantId);

      res.json({
        success: true,
        data: {
          message: 'Manual deliverability check completed',
          tenantId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error running manual check:', error);
      res.status(500).json({
        error: {
          code: 'CHECK_ERROR',
          message: 'Failed to run manual deliverability check'
        }
      });
    }
  }
}