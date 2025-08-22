import { renderHook, act, waitFor } from '@testing-library/react';
import { useSecurityMonitoring } from '../../hooks/useSecurityMonitoring';
import SecurityMonitoringApi from '../../lib/securityMonitoringApi';

// Mock the SecurityMonitoringApi
jest.mock('../../lib/securityMonitoringApi', () => ({
  __esModule: true,
  default: {
    getSecurityMetrics: jest.fn(),
    getThreatAlerts: jest.fn()
  }
}));

const mockSecurityMonitoringApi = SecurityMonitoringApi as jest.Mocked<typeof SecurityMonitoringApi>;

describe('useSecurityMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockMetrics = {
    failedLogins: 5,
    threatAlerts: 2,
    blockedRequests: 10,
    totalEvents: 17,
    timeRange: 24
  };

  const mockThreats = [
    {
      id: '1',
      type: 'BRUTE_FORCE',
      severity: 'HIGH',
      status: 'ACTIVE',
      message: 'Multiple failed login attempts detected',
      timestamp: new Date(),
      metadata: {}
    },
    {
      id: '2',
      type: 'SUSPICIOUS_IP',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      message: 'Suspicious IP address detected',
      timestamp: new Date(),
      metadata: {}
    },
    {
      id: '3',
      type: 'RATE_LIMIT',
      severity: 'MEDIUM',
      status: 'RESOLVED',
      message: 'Rate limit exceeded',
      timestamp: new Date(),
      metadata: {}
    }
  ];

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );
      mockSecurityMonitoringApi.getThreatAlerts.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useSecurityMonitoring());

      expect(result.current.loading).toBe(true);
      expect(result.current.metrics).toBe(null);
      expect(result.current.threats).toEqual([]);
      expect(result.current.error).toBe(null);
      expect(result.current.lastUpdated).toBe(null);
    });

    it('should load data on mount', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.metrics).toEqual(mockMetrics);
      expect(result.current.threats).toEqual(mockThreats);
      expect(result.current.error).toBe(null);
      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockSecurityMonitoringApi.getSecurityMetrics.mockRejectedValue(error);
      mockSecurityMonitoringApi.getThreatAlerts.mockRejectedValue(error);

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('API Error');
      expect(result.current.metrics).toBe(null);
      expect(result.current.threats).toEqual([]);
    });

    it('should handle non-Error exceptions', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockRejectedValue('String error');
      mockSecurityMonitoringApi.getThreatAlerts.mockRejectedValue('String error');

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load security data');
    });
  });

  describe('configuration options', () => {
    it('should use custom time range', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      renderHook(() => useSecurityMonitoring({ timeRange: 48 }));

      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledWith(48);
      });
    });

    it('should disable auto-refresh when specified', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      renderHook(() => useSecurityMonitoring({ autoRefresh: false }));

      // Fast-forward past refresh interval
      act(() => {
        jest.advanceTimersByTime(35000);
      });

      // Should only be called once (initial load)
      expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledTimes(1);
    });

    it('should use custom refresh interval', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      renderHook(() => useSecurityMonitoring({ refreshInterval: 10000 }));

      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledTimes(1);
      });

      // Fast-forward to trigger refresh
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('auto-refresh', () => {
    it('should auto-refresh data at specified interval', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      renderHook(() => useSecurityMonitoring({ refreshInterval: 30000 }));

      // Initial load
      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledTimes(1);
      });

      // Fast-forward to trigger refresh
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear interval on unmount', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      const { unmount } = renderHook(() => useSecurityMonitoring());

      unmount();

      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe('manual refresh', () => {
    it('should refresh data manually', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      const { result } = renderHook(() => useSecurityMonitoring({ autoRefresh: false }));

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Manual refresh
      act(() => {
        result.current.refresh();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledTimes(2);
    });

    it('should clear error on manual refresh', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValue({ alerts: mockThreats });

      const { result } = renderHook(() => useSecurityMonitoring({ autoRefresh: false }));

      // Wait for initial error
      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      // Manual refresh should clear error
      act(() => {
        result.current.refresh();
      });

      expect(result.current.error).toBe(null);

      await waitFor(() => {
        expect(result.current.error).toBe(null);
        expect(result.current.metrics).toEqual(mockMetrics);
      });
    });
  });

  describe('helper functions', () => {
    beforeEach(async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });
    });

    it('should get high priority alerts', async () => {
      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const highPriorityAlerts = result.current.getHighPriorityAlerts();
      
      expect(highPriorityAlerts).toHaveLength(2);
      expect(highPriorityAlerts[0].severity).toBe('HIGH');
      expect(highPriorityAlerts[1].severity).toBe('CRITICAL');
    });

    it('should calculate security score', async () => {
      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const score = result.current.getSecurityScore();
      
      // With 17 total events, score should be 50
      expect(score).toBe(50);
    });

    it('should calculate security score with no events', async () => {
      const noEventsMetrics = {
        failedLogins: 0,
        threatAlerts: 0,
        blockedRequests: 0,
        totalEvents: 0,
        timeRange: 24
      };

      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(noEventsMetrics);

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const score = result.current.getSecurityScore();
      expect(score).toBe(100);
    });

    it('should calculate security score with few events', async () => {
      const fewEventsMetrics = {
        failedLogins: 2,
        threatAlerts: 1,
        blockedRequests: 2,
        totalEvents: 5,
        timeRange: 24
      };

      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(fewEventsMetrics);

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const score = result.current.getSecurityScore();
      expect(score).toBe(90);
    });

    it('should calculate security score with many events', async () => {
      const manyEventsMetrics = {
        failedLogins: 50,
        threatAlerts: 30,
        blockedRequests: 70,
        totalEvents: 150,
        timeRange: 24
      };

      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(manyEventsMetrics);

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const score = result.current.getSecurityScore();
      expect(score).toBe(30);
    });

    it('should detect active threats', async () => {
      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const hasActiveThreats = result.current.hasActiveThreats();
      expect(hasActiveThreats).toBe(true);
    });

    it('should detect no active threats', async () => {
      const resolvedThreats = mockThreats.map(threat => ({
        ...threat,
        status: 'RESOLVED' as const
      }));

      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: resolvedThreats });

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const hasActiveThreats = result.current.hasActiveThreats();
      expect(hasActiveThreats).toBe(false);
    });

    it('should get critical threats', async () => {
      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const criticalThreats = result.current.getCriticalThreats();
      
      expect(criticalThreats).toHaveLength(1);
      expect(criticalThreats[0].severity).toBe('CRITICAL');
      expect(criticalThreats[0].status).toBe('ACTIVE');
    });

    it('should handle null metrics in security score calculation', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(null as any);

      const { result } = renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const score = result.current.getSecurityScore();
      expect(score).toBe(0);
    });
  });

  describe('API call parameters', () => {
    it('should call getThreatAlerts with correct parameters', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      renderHook(() => useSecurityMonitoring());

      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getThreatAlerts).toHaveBeenCalledWith({
          limit: 10,
          status: 'ACTIVE'
        });
      });
    });

    it('should call getSecurityMetrics with correct time range', async () => {
      mockSecurityMonitoringApi.getSecurityMetrics.mockResolvedValue(mockMetrics);
      mockSecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: mockThreats });

      renderHook(() => useSecurityMonitoring({ timeRange: 72 }));

      await waitFor(() => {
        expect(mockSecurityMonitoringApi.getSecurityMetrics).toHaveBeenCalledWith(72);
      });
    });
  });
});