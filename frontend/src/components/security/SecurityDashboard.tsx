'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Globe, 
  Clock,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import SecurityMonitoringApi, { SecurityMetrics, ThreatAlert, AuditLogEntry } from '@/lib/securityMonitoringApi';
import { LoadingState } from '@/components/LoadingState';
import { ErrorDisplay } from '@/components/ErrorDisplay';

interface SecurityDashboardProps {
  className?: string;
}

export function SecurityDashboard({ className }: SecurityDashboardProps) {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [threats, setThreats] = useState<ThreatAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState(24);

  const loadSecurityData = async () => {
    try {
      setError(null);
      const [metricsData, threatsData, auditData] = await Promise.all([
        SecurityMonitoringApi.getSecurityMetrics(timeRange),
        SecurityMonitoringApi.getThreatAlerts({ limit: 10 }),
        SecurityMonitoringApi.getAuditLogs({ limit: 20 })
      ]);

      setMetrics(metricsData);
      setThreats(threatsData.alerts);
      setAuditLogs(auditData.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSecurityData();
  };

  const handleTimeRangeChange = (hours: number) => {
    setTimeRange(hours);
    setLoading(true);
    loadSecurityData();
  };

  useEffect(() => {
    loadSecurityData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading) {
    return <LoadingState message="Loading security dashboard..." />;
  }

  if (error) {
    return (
      <ErrorDisplay 
        error={error} 
        onRetry={loadSecurityData}
        title="Failed to load security dashboard"
      />
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor security events, threats, and compliance status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            <option value={1}>Last Hour</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last Week</option>
            <option value={720}>Last Month</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Security Metrics Overview */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.failedLogins}</div>
              <p className="text-xs text-muted-foreground">
                Authentication failures
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Threat Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.threatAlerts}</div>
              <p className="text-xs text-muted-foreground">
                Active security threats
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.blockedRequests}</div>
              <p className="text-xs text-muted-foreground">
                Requests blocked by security
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspicious IPs</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.suspiciousIps.length}</div>
              <p className="text-xs text-muted-foreground">
                IP addresses flagged
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Security Information */}
      <Tabs defaultValue="threats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threats">Threat Alerts</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="compliance">GDPR Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Threat Alerts</CardTitle>
              <CardDescription>
                Security threats detected in the last {timeRange} hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {threats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No threat alerts in the selected time range</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {threats.map((threat) => (
                    <div
                      key={threat.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(threat.severity)}>
                            {threat.severity}
                          </Badge>
                          <span className="font-medium">{threat.threatType}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {threat.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>IP: {threat.ipAddress}</span>
                          <span>Time: {formatTimestamp(threat.createdAt)}</span>
                        </div>
                      </div>
                      <Badge variant="outline">{threat.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Recent security and user activity logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{log.action}</Badge>
                        <span>{log.resourceType}</span>
                        <span className="text-muted-foreground">
                          by {log.userId || 'System'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>GDPR Compliance</CardTitle>
              <CardDescription>
                Data protection and privacy compliance tools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  GDPR compliance tools allow users to export or delete their personal data.
                  All requests are logged and processed according to data protection regulations.
                </AlertDescription>
              </Alert>
              
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => SecurityMonitoringApi.requestDataExport()}
                  className="h-auto p-4 flex flex-col items-start"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="h-4 w-4" />
                    <span className="font-medium">Request Data Export</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-left">
                    Export all personal data in a portable format
                  </span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => SecurityMonitoringApi.requestDataDeletion()}
                  className="h-auto p-4 flex flex-col items-start"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Request Data Deletion</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-left">
                    Schedule deletion of all personal data
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SecurityDashboard;