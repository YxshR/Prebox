/**
 * Performance monitoring dashboard component
 * Shows real-time performance metrics and optimization suggestions
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChartBarIcon, 
  ClockIcon, 
  CpuChipIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { useBundleAnalyzer } from '../../lib/bundleAnalyzer';

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function PerformanceDashboard({ isVisible, onClose }: PerformanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'bundle' | 'recommendations'>('metrics');
  
  const { metrics, getPerformanceGrade, currentFPS } = usePerformanceMonitoring({
    enableWebVitals: true,
    enableFrameRateMonitoring: true,
    enableMemoryMonitoring: true,
  });

  const { analyze, getReport, getPerformanceImpact, stats } = useBundleAnalyzer();

  useEffect(() => {
    if (isVisible && !stats) {
      analyze();
    }
  }, [isVisible, analyze, stats]);

  if (!isVisible) return null;

  const performanceGrade = getPerformanceGrade();
  const bundleImpact = getPerformanceImpact();

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'Good':
      case 'A':
        return 'text-green-600 bg-green-100';
      case 'Needs Improvement':
      case 'B':
      case 'C':
        return 'text-yellow-600 bg-yellow-100';
      case 'Poor':
      case 'D':
      case 'F':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatMetric = (value: number | undefined, unit: string) => {
    if (value === undefined) return 'N/A';
    return `${Math.round(value)}${unit}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ChartBarIcon className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Performance Dashboard</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'metrics', label: 'Core Metrics', icon: CpuChipIcon },
                { id: 'bundle', label: 'Bundle Analysis', icon: ChartBarIcon },
                { id: 'recommendations', label: 'Recommendations', icon: ExclamationTriangleIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {activeTab === 'metrics' && (
              <div className="space-y-6">
                {/* Overall Grade */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Overall Performance</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(performanceGrade)}`}>
                      {performanceGrade}
                    </span>
                  </div>
                </div>

                {/* Core Web Vitals */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">LCP</span>
                        <ClockIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatMetric(metrics.lcp, 'ms')}
                      </div>
                      <div className="text-xs text-gray-500">Largest Contentful Paint</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">FID</span>
                        <CpuChipIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatMetric(metrics.fid, 'ms')}
                      </div>
                      <div className="text-xs text-gray-500">First Input Delay</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">CLS</span>
                        <ChartBarIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.cls ? metrics.cls.toFixed(3) : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">Cumulative Layout Shift</div>
                    </div>
                  </div>
                </div>

                {/* Real-time Metrics */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Frame Rate</span>
                        <div className={`w-3 h-3 rounded-full ${
                          currentFPS >= 55 ? 'bg-green-400' : currentFPS >= 30 ? 'bg-yellow-400' : 'bg-red-400'
                        }`} />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {currentFPS} FPS
                      </div>
                      <div className="text-xs text-gray-500">Current frame rate</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Memory</span>
                        <CpuChipIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatMetric(metrics.memoryUsage, 'MB')}
                      </div>
                      <div className="text-xs text-gray-500">JavaScript heap size</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bundle' && (
              <div className="space-y-6">
                {/* Bundle Overview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Bundle Performance</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(bundleImpact.grade)}`}>
                      Grade {bundleImpact.grade}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Score: {bundleImpact.score}/100
                  </div>
                </div>

                {/* Bundle Stats */}
                {stats && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Bundle Statistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {Math.round(stats.totalSize / 1024)}KB
                        </div>
                        <div className="text-xs text-gray-500">Total Size</div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {stats.chunks.length}
                        </div>
                        <div className="text-xs text-gray-500">Chunks</div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {Math.round(stats.gzippedSize / 1024)}KB
                        </div>
                        <div className="text-xs text-gray-500">Gzipped Size (est.)</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Issues */}
                {bundleImpact.issues.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Issues Found</h3>
                    <div className="space-y-2">
                      {bundleImpact.issues.map((issue, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <span className="text-sm text-yellow-800">{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="space-y-6">
                {stats?.recommendations && stats.recommendations.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
                    <div className="space-y-4">
                      {stats.recommendations.map((rec, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                rec.severity === 'high' ? 'bg-red-100 text-red-800' :
                                rec.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {rec.severity.toUpperCase()}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {rec.type.replace('-', ' ').toUpperCase()}
                              </span>
                            </div>
                            {rec.potentialSavings > 0 && (
                              <span className="text-sm text-green-600 font-medium">
                                Save {rec.potentialSavings}KB
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                          <p className="text-sm text-gray-800 font-medium">{rec.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Great Job!
                    </h3>
                    <p className="text-gray-600">
                      No optimization recommendations at this time. Your bundle is well optimized!
                    </p>
                  </div>
                )}

                {/* General Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">General Performance Tips</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Use lazy loading for non-critical components</li>
                    <li>• Optimize images with WebP format and proper sizing</li>
                    <li>• Minimize JavaScript bundle size through code splitting</li>
                    <li>• Enable compression (gzip/brotli) on your server</li>
                    <li>• Use a CDN for static assets</li>
                    <li>• Implement proper caching strategies</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}