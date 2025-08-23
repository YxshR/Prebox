interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  event: string;
  message: string;
  metadata?: Record<string, any>;
  sessionId?: string;
  userId?: string;
}

class SecurityLoggerClass {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  log(event: string, message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      message,
      metadata: this.sanitizeMetadata(metadata),
      sessionId: this.sessionId,
      userId: this.getCurrentUserId()
    };

    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SECURITY] ${event}: ${message}`, metadata);
    }

    // In production, you would send this to your logging service
    this.sendToLoggingService(entry);
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'otp', 'code'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 100) {
        sanitized[key] = sanitized[key].substring(0, 100) + '...';
      }
    });

    return sanitized;
  }

  private getCurrentUserId(): string | undefined {
    try {
      // Try to get user ID from localStorage or JWT token
      const token = localStorage.getItem('accessToken');
      if (token) {
        // In a real implementation, you would decode the JWT token
        // For now, return a placeholder
        return 'current_user_id';
      }
    } catch (error) {
      // Ignore errors when accessing localStorage
    }
    return undefined;
  }

  private async sendToLoggingService(entry: LogEntry): Promise<void> {
    try {
      // In production, send to your logging service
      // For now, we'll just store it locally
      
      if (typeof window !== 'undefined') {
        // Store in sessionStorage for debugging
        const existingLogs = sessionStorage.getItem('security_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push(entry);
        
        // Keep only the last 100 logs in sessionStorage
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        sessionStorage.setItem('security_logs', JSON.stringify(logs));
      }
    } catch (error) {
      console.error('Failed to send log to service:', error);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByEvent(event: string): LogEntry[] {
    return this.logs.filter(log => log.event === event);
  }

  clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('security_logs');
    }
  }

  // Security-specific logging methods
  logAuthAttempt(method: string, identifier: string): void {
    this.log('AUTH_ATTEMPT', `Authentication attempt via ${method}`, {
      method,
      identifier: this.maskIdentifier(identifier)
    });
  }

  logAuthSuccess(method: string, userId: string): void {
    this.log('AUTH_SUCCESS', `Authentication successful via ${method}`, {
      method,
      userId
    });
  }

  logAuthFailure(method: string, identifier: string, reason: string): void {
    this.log('AUTH_FAILURE', `Authentication failed via ${method}`, {
      method,
      identifier: this.maskIdentifier(identifier),
      reason
    });
  }

  logSuspiciousActivity(activity: string, details: Record<string, any>): void {
    this.log('SUSPICIOUS_ACTIVITY', `Suspicious activity detected: ${activity}`, details);
  }

  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      // Email masking
      const [local, domain] = identifier.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    } else if (identifier.match(/^\+?\d+$/)) {
      // Phone number masking
      return identifier.substring(0, 3) + '***' + identifier.substring(identifier.length - 2);
    }
    return identifier.substring(0, 3) + '***';
  }
}

export const SecurityLogger = new SecurityLoggerClass();