'use client';

import { useState, useEffect, useCallback } from 'react';
import SecurityMonitoringApi, { SecurityMetrics, ThreatAlert } from '@/lib/securityMonitoringApi';

interface UseSecurityMonitoringOptions {
  refreshInterval?: number;
  timeRange?: number;
  autoRefresh?: boolean;
}

interface SecurityMonitoringState {
  metrics: SecurityMetrics | null;
  threats: ThreatAlert[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useSecurityMonitoring(options: UseSecurityMonitoringOptions = {}) {
  const {
    refreshInterval = 30000, // 30 seconds
    timeRange = 24,
    autoRefresh = true
  } = options;

  const [state, setState] = useState<SecurityMonitoringState>({
    metrics: null,
    threats: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  const loadSecurityData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const [metricsData, threatsData] = await Promise.all([
        SecurityMonitoringApi.getSecurityMetrics(timeRange),
        SecurityMonitoringApi.getThreatAlerts({ limit: 10, status: 'ACTIVE' })
      ]);

      setState(prev => ({
        ...prev,
        metrics: metricsData,
        threats: threatsData.alerts,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load security data',
        loading: false
      }));
    }
  }, [timeRange]);

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }));
    loadSecurityData();
  }, [loadSecurityData]);

  // Initial load
  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadSecurityData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadSecurityData, refreshInterval, autoRefresh]);

  // Security event notifications
  const getHighPriorityAlerts = useCallback(() => {
    return state.threats.filter(threat => 
      threat.severity === 'CRITICAL' || threat.severity === 'HIGH'
    );
  }, [state.threats]);

  const getSecurityScore = useCallback(() => {
    if (!state.metrics) return 0;
    
    const { failedLogins, threatAlerts, blockedRequests } = state.metrics;
    const totalEvents = failedLogins + threatAlerts + blockedRequests;
    
    // Simple scoring algorithm (0-100, higher is better)
    if (totalEvents === 0) return 100;
    if (totalEvents < 10) return 90;
    if (totalEvents < 50) return 70;
    if (totalEvents < 100) return 50;
    return 30;
  }, [state.metrics]);

  const hasActiveThreats = useCallback(() => {
    return state.threats.some(threat => threat.status === 'ACTIVE');
  }, [state.threats]);

  const getCriticalThreats = useCallback(() => {
    return state.threats.filter(threat => 
      threat.severity === 'CRITICAL' && threat.status === 'ACTIVE'
    );
  }, [state.threats]);

  return {
    ...state,
    refresh,
    getHighPriorityAlerts,
    getSecurityScore,
    hasActiveThreats,
    getCriticalThreats
  };
}

export default useSecurityMonitoring;