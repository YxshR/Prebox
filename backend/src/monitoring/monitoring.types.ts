export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
  errorMessage?: string;
}

export interface BusinessMetric {
  name: string;
  value: number;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  timeWindow: number; // in minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheck[];
  timestamp: Date;
  uptime: number;
}

export interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  timestamp: Date;
  userId?: string;
  tenantId?: string;
  endpoint?: string;
  method?: string;
  metadata?: Record<string, any>;
}

export interface MonitoringConfig {
  metricsRetentionDays: number;
  alertingEnabled: boolean;
  healthCheckInterval: number;
  performanceThresholds: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  businessMetrics: {
    emailsSentDaily: boolean;
    subscriptionChanges: boolean;
    apiUsage: boolean;
    revenueTracking: boolean;
  };
}