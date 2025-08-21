'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SecurityLogger, ClientRateLimiter } from '../../lib/security';
import { securityMiddleware } from '../../lib/securityMiddleware';

/**
 * Security monitoring component for development and admin use
 */
interface SecurityMonitorProps {
  showInProduction?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  minimized?: boolean;
}

export const SecurityMonitor: React.FC<SecurityMonitorProps> = ({
  showInProduction = false,
  position = 'bottom-right',
  minimized = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    suspiciousActivities: 0,
    lastActivity: 0
  });
  const [logs, setLogs] = useState<Array<{
    timestamp: number;
    type: string;
    message: string;
    data?: any;
  }>>([]);

  // Only show in development or when explicitly enabled for production
  useEffect(() => {
    const shouldShow = process.env.NODE_ENV === 'development' || showInProduction;
    setIsVisible(shouldShow);
  }, [showInProduction]);

  // Update metrics and logs periodically
  useEffect(() => {
    if (!isVisible) return;

    const updateData = () => {
      setMetrics(securityMiddleware.getSecurityMetrics());
      setLogs(SecurityLogger.getLogs().slice(-20)); // Last 20 logs
    };

    updateData();
    const interval = setInterval(updateData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const getStatusColor = () => {
    if (metrics.suspiciousActivities > 0) return 'bg-red-500';
    if (metrics.rateLimitedRequests > 0) return 'bg-yellow-500';
    if (metrics.failedRequests > metrics.totalRequests * 0.1) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const clearLogs = () => {
    SecurityLogger.clearLogs();
    ClientRateLimiter.clearAll();
    setLogs([]);
    setMetrics({
      totalRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      suspiciousActivities: 0,
      lastActivity: 0
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`fixed ${positionClasses[position]} z-50 font-mono text-xs`}
    >
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="font-semibold text-gray-700">Security Monitor</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-500 hover:text-gray-700 p-1"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              {/* Metrics */}
              <div className="p-3 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Requests:</span>
                    <span className="ml-1 font-semibold">{metrics.totalRequests}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Failed:</span>
                    <span className="ml-1 font-semibold text-red-600">{metrics.failedRequests}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rate Limited:</span>
                    <span className="ml-1 font-semibold text-yellow-600">{metrics.rateLimitedRequests}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Suspicious:</span>
                    <span className="ml-1 font-semibold text-red-600">{metrics.suspiciousActivities}</span>
                  </div>
                </div>
                
                {metrics.lastActivity > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Last activity: {formatTimestamp(metrics.lastActivity)}
                  </div>
                )}

                <button
                  onClick={clearLogs}
                  className="mt-2 px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                >
                  Clear Logs
                </button>
              </div>

              {/* Recent Logs */}
              <div className="p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Recent Activity</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {logs.length === 0 ? (
                    <div className="text-gray-500 text-xs">No recent activity</div>
                  ) : (
                    logs.slice().reverse().map((log, index) => (
                      <div
                        key={`${log.timestamp}-${index}`}
                        className={`text-xs p-1 rounded ${
                          log.type.includes('ERROR') || log.type.includes('SUSPICIOUS')
                            ? 'bg-red-50 text-red-700'
                            : log.type.includes('RATE_LIMIT')
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{log.type}</span>
                          <span className="text-xs opacity-75">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs opacity-90">
                          {log.message}
                        </div>
                        {log.data && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs opacity-75">
                              Details
                            </summary>
                            <pre className="mt-1 text-xs bg-white p-1 rounded overflow-auto max-h-20">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/**
 * Security status indicator component
 */
interface SecurityStatusProps {
  className?: string;
}

export const SecurityStatus: React.FC<SecurityStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<'secure' | 'warning' | 'danger'>('secure');
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    suspiciousActivities: 0,
    lastActivity: 0
  });

  useEffect(() => {
    const updateStatus = () => {
      const currentMetrics = securityMiddleware.getSecurityMetrics();
      setMetrics(currentMetrics);

      // Determine security status
      if (currentMetrics.suspiciousActivities > 0) {
        setStatus('danger');
      } else if (
        currentMetrics.rateLimitedRequests > 0 ||
        currentMetrics.failedRequests > currentMetrics.totalRequests * 0.1
      ) {
        setStatus('warning');
      } else {
        setStatus('secure');
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    secure: {
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      icon: '🔒',
      text: 'Secure'
    },
    warning: {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      icon: '⚠️',
      text: 'Warning'
    },
    danger: {
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      icon: '🚨',
      text: 'Alert'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}>
      <span className="mr-1">{config.icon}</span>
      <span>{config.text}</span>
      {metrics.totalRequests > 0 && (
        <span className="ml-1 opacity-75">
          ({metrics.totalRequests} req)
        </span>
      )}
    </div>
  );
};

/**
 * Hook for security monitoring
 */
export const useSecurityMonitoring = () => {
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    suspiciousActivities: 0,
    lastActivity: 0
  });

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(securityMiddleware.getSecurityMetrics());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    logs: SecurityLogger.getLogs(),
    clearLogs: () => {
      SecurityLogger.clearLogs();
      ClientRateLimiter.clearAll();
    }
  };
};