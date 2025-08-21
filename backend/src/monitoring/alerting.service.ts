import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import nodemailer from 'nodemailer';
import { AlertRule, Alert, AlertChannel } from './monitoring.types';
import { v4 as uuidv4 } from 'uuid';

export class AlertingService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private emailTransporter: nodemailer.Transporter;
  private checkInterval: NodeJS.Timeout;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    
    // Initialize email transporter for alerts
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Check alert rules every minute
    this.checkInterval = setInterval(() => {
      this.checkAlertRules();
    }, 60000);
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    try {
      const id = uuidv4();
      const alertRule: AlertRule = { ...rule, id };

      await this.db.query(`
        INSERT INTO alert_rules 
        (id, name, metric, condition, threshold, time_window, severity, enabled, channels)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        alertRule.id,
        alertRule.name,
        alertRule.metric,
        alertRule.condition,
        alertRule.threshold,
        alertRule.timeWindow,
        alertRule.severity,
        alertRule.enabled,
        JSON.stringify(alertRule.channels)
      ]);

      this.logger.info('Alert rule created', { ruleId: id, name: rule.name });
      return alertRule;

    } catch (error) {
      this.logger.error('Failed to create alert rule', { error, rule });
      throw error;
    }
  }

  /**
   * Update an alert rule
   */
  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id')
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const values = Object.entries(updates)
        .filter(([key]) => key !== 'id')
        .map(([key, value]) => {
          if (key === 'channels') {
            return JSON.stringify(value);
          }
          return value;
        });

      await this.db.query(`
        UPDATE alert_rules 
        SET ${setClause}
        WHERE id = $1
      `, [id, ...values]);

      this.logger.info('Alert rule updated', { ruleId: id, updates });

    } catch (error) {
      this.logger.error('Failed to update alert rule', { error, id, updates });
      throw error;
    }
  }

  /**
   * Delete an alert rule
   */
  async deleteAlertRule(id: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM alert_rules WHERE id = $1', [id]);
      this.logger.info('Alert rule deleted', { ruleId: id });

    } catch (error) {
      this.logger.error('Failed to delete alert rule', { error, id });
      throw error;
    }
  }

  /**
   * Get all alert rules
   */
  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const result = await this.db.query(`
        SELECT id, name, metric, condition, threshold, time_window, severity, enabled, channels
        FROM alert_rules
        ORDER BY name
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        metric: row.metric,
        condition: row.condition,
        threshold: row.threshold,
        timeWindow: row.time_window,
        severity: row.severity,
        enabled: row.enabled,
        channels: row.channels
      }));

    } catch (error) {
      this.logger.error('Failed to get alert rules', { error });
      return [];
    }
  }

  /**
   * Create an alert
   */
  async createAlert(alert: Omit<Alert, 'id'>): Promise<Alert> {
    try {
      const id = uuidv4();
      const newAlert: Alert = { ...alert, id };

      await this.db.query(`
        INSERT INTO alerts 
        (id, rule_id, message, severity, timestamp, resolved, resolved_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        newAlert.id,
        newAlert.ruleId,
        newAlert.message,
        newAlert.severity,
        newAlert.timestamp,
        newAlert.resolved,
        newAlert.resolvedAt,
        JSON.stringify(newAlert.metadata || {})
      ]);

      // Send alert notifications
      await this.sendAlertNotifications(newAlert);

      this.logger.warn('Alert created', newAlert);
      return newAlert;

    } catch (error) {
      this.logger.error('Failed to create alert', { error, alert });
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(id: string): Promise<void> {
    try {
      const resolvedAt = new Date();
      
      await this.db.query(`
        UPDATE alerts 
        SET resolved = true, resolved_at = $2
        WHERE id = $1
      `, [id, resolvedAt]);

      this.logger.info('Alert resolved', { alertId: id, resolvedAt });

    } catch (error) {
      this.logger.error('Failed to resolve alert', { error, id });
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const result = await this.db.query(`
        SELECT id, rule_id, message, severity, timestamp, resolved, resolved_at, metadata
        FROM alerts
        WHERE resolved = false
        ORDER BY timestamp DESC
      `);

      return result.rows.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        message: row.message,
        severity: row.severity,
        timestamp: row.timestamp,
        resolved: row.resolved,
        resolvedAt: row.resolved_at,
        metadata: row.metadata
      }));

    } catch (error) {
      this.logger.error('Failed to get active alerts', { error });
      return [];
    }
  }

  /**
   * Check alert rules against current metrics
   */
  private async checkAlertRules(): Promise<void> {
    try {
      const rules = await this.getAlertRules();
      const enabledRules = rules.filter(rule => rule.enabled);

      for (const rule of enabledRules) {
        await this.evaluateRule(rule);
      }

    } catch (error) {
      this.logger.error('Failed to check alert rules', { error });
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      // Get recent metric values
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - rule.timeWindow * 60000);

      let metricValue: number;

      // Get metric value based on type
      if (rule.metric.startsWith('business:')) {
        metricValue = await this.getBusinessMetricValue(rule.metric, startTime, endTime);
      } else if (rule.metric.startsWith('performance:')) {
        metricValue = await this.getPerformanceMetricValue(rule.metric, startTime, endTime);
      } else {
        metricValue = await this.getSystemMetricValue(rule.metric);
      }

      // Evaluate condition
      const conditionMet = this.evaluateCondition(metricValue, rule.condition, rule.threshold);

      if (conditionMet) {
        // Check if we already have an active alert for this rule
        const existingAlert = await this.db.query(`
          SELECT id FROM alerts 
          WHERE rule_id = $1 AND resolved = false
          ORDER BY timestamp DESC LIMIT 1
        `, [rule.id]);

        if (existingAlert.rows.length === 0) {
          // Create new alert
          await this.createAlert({
            ruleId: rule.id,
            message: `Alert: ${rule.name} - ${rule.metric} is ${metricValue} (threshold: ${rule.threshold})`,
            severity: rule.severity,
            timestamp: new Date(),
            resolved: false,
            metadata: {
              metricValue,
              threshold: rule.threshold,
              condition: rule.condition
            }
          });
        }
      } else {
        // Auto-resolve alerts if condition is no longer met
        await this.db.query(`
          UPDATE alerts 
          SET resolved = true, resolved_at = $2
          WHERE rule_id = $1 AND resolved = false
        `, [rule.id, new Date()]);
      }

    } catch (error) {
      this.logger.error('Failed to evaluate alert rule', { error, ruleId: rule.id });
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Get business metric value
   */
  private async getBusinessMetricValue(metric: string, startTime: Date, endTime: Date): Promise<number> {
    const metricName = metric.replace('business:', '');
    
    const result = await this.db.query(`
      SELECT COALESCE(SUM(value), 0) as total_value
      FROM business_metrics 
      WHERE name = $1 AND timestamp BETWEEN $2 AND $3
    `, [metricName, startTime, endTime]);

    return parseFloat(result.rows[0].total_value);
  }

  /**
   * Get performance metric value
   */
  private async getPerformanceMetricValue(metric: string, startTime: Date, endTime: Date): Promise<number> {
    if (metric === 'performance:error_rate') {
      const errorResult = await this.db.query(`
        SELECT COUNT(*) as error_count
        FROM performance_metrics 
        WHERE timestamp BETWEEN $1 AND $2 AND status_code >= 400
      `, [startTime, endTime]);

      const totalResult = await this.db.query(`
        SELECT COUNT(*) as total_count
        FROM performance_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `, [startTime, endTime]);

      const errorCount = parseInt(errorResult.rows[0].error_count);
      const totalCount = parseInt(totalResult.rows[0].total_count);

      return totalCount > 0 ? errorCount / totalCount : 0;
    }

    if (metric === 'performance:avg_response_time') {
      const result = await this.db.query(`
        SELECT COALESCE(AVG(response_time), 0) as avg_time
        FROM performance_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `, [startTime, endTime]);

      return parseFloat(result.rows[0].avg_time);
    }

    return 0;
  }

  /**
   * Get system metric value
   */
  private async getSystemMetricValue(metric: string): Promise<number> {
    switch (metric) {
      case 'system:memory_usage':
        const memUsage = process.memoryUsage();
        return memUsage.heapUsed / memUsage.heapTotal;
      
      case 'system:uptime':
        return process.uptime();
      
      default:
        return 0;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    try {
      // Get the alert rule to access notification channels
      const ruleResult = await this.db.query(`
        SELECT channels FROM alert_rules WHERE id = $1
      `, [alert.ruleId]);

      if (ruleResult.rows.length === 0) return;

      const channels: AlertChannel[] = ruleResult.rows[0].channels;

      for (const channel of channels) {
        switch (channel.type) {
          case 'email':
            await this.sendEmailAlert(alert, channel);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert, channel);
            break;
          case 'slack':
            await this.sendSlackAlert(alert, channel);
            break;
        }
      }

    } catch (error) {
      this.logger.error('Failed to send alert notifications', { error, alertId: alert.id });
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.ALERT_FROM_EMAIL || 'alerts@bulkemail.com',
        to: channel.config.email,
        subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
        html: `
          <h2>Alert Notification</h2>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
          <p><strong>Metadata:</strong> ${JSON.stringify(alert.metadata, null, 2)}</p>
        `
      });

      this.logger.info('Email alert sent', { alertId: alert.id, email: channel.config.email });

    } catch (error) {
      this.logger.error('Failed to send email alert', { error, alertId: alert.id });
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      const response = await fetch(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(channel.config.headers || {})
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      this.logger.info('Webhook alert sent', { alertId: alert.id, url: channel.config.url });

    } catch (error) {
      this.logger.error('Failed to send webhook alert', { error, alertId: alert.id });
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      const slackMessage = {
        text: `Alert: ${alert.message}`,
        attachments: [
          {
            color: this.getSeverityColor(alert.severity),
            fields: [
              {
                title: 'Severity',
                value: alert.severity,
                short: true
              },
              {
                title: 'Timestamp',
                value: alert.timestamp.toISOString(),
                short: true
              }
            ]
          }
        ]
      };

      const response = await fetch(channel.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackMessage)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }

      this.logger.info('Slack alert sent', { alertId: alert.id });

    } catch (error) {
      this.logger.error('Failed to send Slack alert', { error, alertId: alert.id });
    }
  }

  /**
   * Get color for alert severity
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'good';
      case 'low':
        return '#439FE0';
      default:
        return 'good';
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}