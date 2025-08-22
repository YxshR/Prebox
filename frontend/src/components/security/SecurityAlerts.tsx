'use client';

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Shield, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Activity
} from 'lucide-react';
import SecurityMonitoringApi from '@/lib/securityMonitoringApi';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';

interface SecurityHealth {
  threatDetection: boolean;
  auditLogging: boolean;
  database: boolean;
  redis: boolean;
  alerting: boolean;
  overall: boolean;
  lastCheck: string;
  errors: string[];
}

interface SecurityAlertsProps {
  className?: string;
  showHealthStatus?: boolean;
  autoRefresh?: boolean;
}

export function SecurityAlerts({ 
  className, 
  showHealthStatus = true,
  autoRefresh = true 
}: SecurityAlertsProps) {
  const [healthStatus, setHealthStatus] = useState<SecurityHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  const { 
    threats, 
    getHighPriorityAlerts, 
    getCriticalThreats,
    hasActiveThreats,
    getSecurityScore 
  } = useSecurityMonitoring({ autoRefresh });

  const loadHealthStatus = async () => {
    if (!showHealthStatus) return;
    
    try {
      setHealthLoading(true);
      setHealthError(null);
      
      const response = await SecurityMonitoringApi.getSecurityMetrics();
      // Health status would be included in the response in a real implementation
      // For now, we'll simulate it based on the metrics
      const simulatedHealth: SecurityHealth = {
        threatDetection: true,
        auditLogging: true,
        database: true,
        redis: true,
        alerting: true,
        overall: true,
        lastCheck: new Date().toISOString(),
        errors: []
      };
      
      setHealthStatus(simulatedHealth);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Failed to load health status');
      // Set unhealthy status on error
      setHealthStatus({
        threatDetection: false,
        auditLogging: false,
        database: false,
        redis: false,
        alerting: false,
        overall: false,
        lastCheck: new Date().toISOString(),
        errors: ['Failed to connect to security monitoring system']
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const triggerRecovery = async () => {
    try {
      setRecovering(true);
      // In a real implementation, this would call the recovery endpoint
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate recovery
      await loadHealthStatus();
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Recovery failed');
    } finally {
      setRecovering(false);
    }
  };

  useEffect(() => {
    loadHealthStatus();
    
    if (autoRefresh && showHealthStatus) {
      const interval = setInterval(loadHealthStatus, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [showHealthStatus, autoRefresh]);

  const highPriorityAlerts = getHighPriorityAlerts();
  const criticalThreats = getCriticalThreats();
  const securityScore = getSecurityScore();
  const activeThreats = hasActiveThreats();

  const getHealthIcon = (healthy: boolean) => {
    return healthy ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Critical Alerts */}
      {criticalThreats.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Critical Security Alert:</strong> {criticalThreats.length} critical threat(s) detected.
            Immediate attention required.
          </AlertDescription>
        </Alert>
      )}

      {/* High Priority Alerts */}
      {highPriorityAlerts.length > 0 && criticalThreats.length === 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Security Alert:</strong> {highPriorityAlerts.length} high priority threat(s) detected.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className={`text-2xl font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}/100
            </div>
            <Badge variant={activeThreats ? "destructive" : "default"}>
              {activeThreats ? "Active Threats" : "Secure"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Based on recent security events and threat activity
          </p>
        </CardContent>
      </Card>

      {/* System Health Status */}
      {showHealthStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Health
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadHealthStatus}
                disabled={healthLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${healthLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthError ? (
              <div className="space-y-3">
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {healthError}
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerRecovery}
                  disabled={recovering}
                  className="w-full"
                >
                  <RefreshCw className={`h-3 w-3 mr-2 ${recovering ? 'animate-spin' : ''}`} />
                  {recovering ? 'Recovering...' : 'Trigger Recovery'}
                </Button>
              </div>
            ) : healthStatus ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Threat Detection</span>
                    {getHealthIcon(healthStatus.threatDetection)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Audit Logging</span>
                    {getHealthIcon(healthStatus.auditLogging)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Database</span>
                    {getHealthIcon(healthStatus.database)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Redis Cache</span>
                    {getHealthIcon(healthStatus.redis)}
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Overall Status</span>
                    <Badge variant={healthStatus.overall ? "default" : "destructive"}>
                      {healthStatus.overall ? "Healthy" : "Degraded"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last checked: {new Date(healthStatus.lastCheck).toLocaleString()}
                  </p>
                </div>

                {healthStatus.errors.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-red-600 mb-1">Issues:</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {healthStatus.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={triggerRecovery}
                      disabled={recovering}
                      className="w-full mt-2"
                    >
                      <RefreshCw className={`h-3 w-3 mr-2 ${recovering ? 'animate-spin' : ''}`} />
                      {recovering ? 'Recovering...' : 'Trigger Recovery'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Loading health status...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SecurityAlerts;