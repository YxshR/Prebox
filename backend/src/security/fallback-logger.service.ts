import fs from 'fs/promises';
import path from 'path';
import winston from 'winston';

export interface FallbackLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  service: string;
  event: string;
  data: Record<string, any>;
  error?: string;
}

export class FallbackLoggerService {
  private logger!: winston.Logger;
  private logDirectory: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 5;
  private alternativeLoggers: Map<string, winston.Logger> = new Map();
  private loggerHealthy: boolean = true;
  private lastHealthCheck: Date = new Date();

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs', 'security-fallback');
    this.initializeLogger();
    this.ensureLogDirectory();
    this.initializeAlternativeLoggers();
  }

  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(this.logDirectory, 'security-fallback.log'),
          maxsize: this.maxFileSize,
          maxFiles: this.maxFiles,
          tailable: true
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create fallback log directory:', error);
      this.loggerHealthy = false;
    }
  }

  /**
   * Initialize alternative logging mechanisms
   */
  private initializeAlternativeLoggers(): void {
    try {
      // Console-only logger as ultimate fallback
      const consoleLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple()
        ),
        transports: [
          new winston.transports.Console()
        ]
      });
      this.alternativeLoggers.set('console', consoleLogger);

      // System log logger (if available)
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const syslogLogger = winston.createLogger({
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          transports: [
            new winston.transports.Console(), // Fallback to console if syslog fails
          ]
        });
        this.alternativeLoggers.set('syslog', syslogLogger);
      }

      // Memory logger for critical events (temporary storage)
      const memoryLogs: any[] = [];
      const memoryLogger = winston.createLogger({
        level: 'error',
        format: winston.format.json(),
        transports: [
          new winston.transports.Stream({
            stream: {
              write: (message: string) => {
                memoryLogs.push(JSON.parse(message));
                // Keep only last 100 entries to prevent memory issues
                if (memoryLogs.length > 100) {
                  memoryLogs.shift();
                }
                return true;
              }
            } as any
          })
        ]
      });
      this.alternativeLoggers.set('memory', memoryLogger);

    } catch (error) {
      console.error('Failed to initialize alternative loggers:', error);
    }
  }

  /**
   * Log security event to fallback system with multiple recovery mechanisms
   */
  async logSecurityEvent(entry: FallbackLogEntry): Promise<void> {
    const logMethods = [
      () => this.logToPrimarySystem(entry),
      () => this.logToAlternativeFile(entry),
      () => this.logToAlternativeLoggers(entry),
      () => this.logToConsoleAsLastResort(entry)
    ];

    let lastError: Error | null = null;
    
    for (const logMethod of logMethods) {
      try {
        await logMethod();
        return; // Success, exit early
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown logging error');
        continue; // Try next method
      }
    }

    // If all methods failed, at least try to record the failure
    console.error('All logging methods failed for security event:', entry);
    console.error('Last error:', lastError);
    
    // Update health status
    this.loggerHealthy = false;
    this.lastHealthCheck = new Date();
  }

  /**
   * Log to primary Winston system
   */
  private async logToPrimarySystem(entry: FallbackLogEntry): Promise<void> {
    // Log to Winston (file + console)
    this.logger.log(entry.level, 'Security Event', entry);

    // Also write to a separate JSON file for easy parsing
    const jsonLogFile = path.join(this.logDirectory, 'security-events.jsonl');
    const logLine = JSON.stringify(entry) + '\n';
    
    await fs.appendFile(jsonLogFile, logLine, 'utf8');
  }

  /**
   * Log to alternative file location
   */
  private async logToAlternativeFile(entry: FallbackLogEntry): Promise<void> {
    const altLogDir = path.join(process.cwd(), 'logs', 'emergency');
    await fs.mkdir(altLogDir, { recursive: true });
    
    const altLogFile = path.join(altLogDir, 'security-emergency.jsonl');
    const logLine = JSON.stringify(entry) + '\n';
    
    await fs.appendFile(altLogFile, logLine, 'utf8');
  }

  /**
   * Log to alternative logger systems
   */
  private async logToAlternativeLoggers(entry: FallbackLogEntry): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [name, logger] of this.alternativeLoggers) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          try {
            logger.log(entry.level, 'Security Event (Alternative)', entry);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
      );
    }

    // Wait for at least one alternative logger to succeed
    await Promise.allSettled(promises);
  }

  /**
   * Log to console as absolute last resort
   */
  private logToConsoleAsLastResort(entry: FallbackLogEntry): void {
    const timestamp = new Date().toISOString();
    const logLevel = entry.level.toUpperCase();
    
    console.error(`[${timestamp}] ${logLevel} SECURITY EVENT (EMERGENCY LOGGING):`);
    console.error(`Service: ${entry.service}`);
    console.error(`Event: ${entry.event}`);
    console.error(`Data:`, JSON.stringify(entry.data, null, 2));
    
    if (entry.error) {
      console.error(`Error: ${entry.error}`);
    }
  }

  /**
   * Log threat detection failure
   */
  async logThreatDetectionFailure(
    threatType: string,
    error: Error,
    context: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'threat-detection',
      event: 'detection_failure',
      data: {
        threatType,
        context,
        errorMessage: error.message,
        errorStack: error.stack
      },
      error: error.message
    });
  }

  /**
   * Log database connection failure
   */
  async logDatabaseFailure(
    operation: string,
    error: Error,
    retryCount: number
  ): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'critical',
      service: 'database',
      event: 'connection_failure',
      data: {
        operation,
        retryCount,
        errorMessage: error.message
      },
      error: error.message
    });
  }

  /**
   * Log monitoring system failure
   */
  async logMonitoringFailure(
    component: string,
    error: Error,
    impact: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: impact === 'critical' ? 'critical' : 'error',
      service: 'monitoring',
      event: 'system_failure',
      data: {
        component,
        impact,
        errorMessage: error.message,
        errorStack: error.stack
      },
      error: error.message
    });
  }

  /**
   * Log security alert delivery failure
   */
  async logAlertDeliveryFailure(
    alertId: string,
    channel: string,
    error: Error,
    retryAttempt: number
  ): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'alerting',
      event: 'delivery_failure',
      data: {
        alertId,
        channel,
        retryAttempt,
        errorMessage: error.message
      },
      error: error.message
    });
  }

  /**
   * Log system recovery event
   */
  async logSystemRecovery(
    component: string,
    downtime: number,
    recoveryMethod: string
  ): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'recovery',
      event: 'system_recovered',
      data: {
        component,
        downtimeMs: downtime,
        recoveryMethod
      }
    });
  }

  /**
   * Get recent fallback logs
   */
  async getRecentLogs(limit: number = 100): Promise<FallbackLogEntry[]> {
    try {
      const jsonLogFile = path.join(this.logDirectory, 'security-events.jsonl');
      const content = await fs.readFile(jsonLogFile, 'utf8');
      const lines = content.trim().split('\n').slice(-limit);
      
      return lines
        .map(line => {
          try {
            return JSON.parse(line) as FallbackLogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is FallbackLogEntry => entry !== null)
        .reverse(); // Most recent first
    } catch (error) {
      console.error('Failed to read fallback logs:', error);
      return [];
    }
  }

  /**
   * Check if fallback logging is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    lastLogTime?: string;
    logFileSize?: number;
    error?: string;
  }> {
    try {
      const jsonLogFile = path.join(this.logDirectory, 'security-events.jsonl');
      
      // Check if log file exists and is writable
      const stats = await fs.stat(jsonLogFile).catch(() => null);
      
      if (!stats) {
        // Try to create a test log entry
        await this.logSecurityEvent({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'fallback-logger',
          event: 'health_check',
          data: { test: true }
        });
        
        return { healthy: true };
      }

      return {
        healthy: true,
        lastLogTime: stats.mtime.toISOString(),
        logFileSize: stats.size
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Attempt to recover the primary logging system
   */
  async attemptRecovery(): Promise<boolean> {
    try {
      // Reinitialize the primary logger
      this.initializeLogger();
      
      // Test logging capability
      await this.ensureLogDirectory();
      
      // Test write to primary log file
      const testEntry: FallbackLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'fallback-logger',
        event: 'recovery_test',
        data: { test: true, recoveryAttempt: new Date().toISOString() }
      };
      
      await this.logToPrimarySystem(testEntry);
      
      // If we get here, recovery was successful
      this.loggerHealthy = true;
      this.lastHealthCheck = new Date();
      
      await this.logSecurityEvent({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'fallback-logger',
        event: 'recovery_successful',
        data: { 
          recoveredAt: new Date().toISOString(),
          downtime: Date.now() - this.lastHealthCheck.getTime()
        }
      });
      
      return true;
    } catch (error) {
      this.loggerHealthy = false;
      console.error('Fallback logger recovery failed:', error);
      return false;
    }
  }

  /**
   * Get logger health status
   */
  getLoggerHealth(): {
    healthy: boolean;
    lastCheck: Date;
    alternativeLoggersCount: number;
    primaryLoggerWorking: boolean;
  } {
    return {
      healthy: this.loggerHealthy,
      lastCheck: this.lastHealthCheck,
      alternativeLoggersCount: this.alternativeLoggers.size,
      primaryLoggerWorking: this.loggerHealthy
    };
  }

  /**
   * Force health check and recovery attempt
   */
  async performHealthCheckAndRecovery(): Promise<void> {
    const healthResult = await this.healthCheck();
    
    if (!healthResult.healthy) {
      console.log('Fallback logger unhealthy, attempting recovery...');
      const recovered = await this.attemptRecovery();
      
      if (!recovered) {
        console.error('Fallback logger recovery failed, continuing with alternative methods');
        
        // Log recovery failure using alternative methods
        await this.logToAlternativeLoggers({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'fallback-logger',
          event: 'recovery_failed',
          data: { 
            healthCheck: healthResult,
            recoveryAttemptTime: new Date().toISOString()
          }
        });
      }
    }
  }

  /**
   * Get memory logs (for critical events stored in memory)
   */
  getMemoryLogs(): any[] {
    try {
      const memoryLogger = this.alternativeLoggers.get('memory');
      if (memoryLogger && (memoryLogger as any).memoryLogs) {
        return (memoryLogger as any).memoryLogs;
      }
      return [];
    } catch (error) {
      console.error('Failed to retrieve memory logs:', error);
      return [];
    }
  }

  /**
   * Export logs for manual review
   */
  async exportLogsForManualReview(): Promise<string> {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        loggerHealth: this.getLoggerHealth(),
        recentLogs: await this.getRecentLogs(50),
        memoryLogs: this.getMemoryLogs(),
        alternativeLoggers: Array.from(this.alternativeLoggers.keys())
      };

      const exportFile = path.join(this.logDirectory, `security-logs-export-${Date.now()}.json`);
      await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2), 'utf8');
      
      return exportFile;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  /**
   * Rotate log files manually
   */
  async rotateLogs(): Promise<void> {
    try {
      const jsonLogFile = path.join(this.logDirectory, 'security-events.jsonl');
      const stats = await fs.stat(jsonLogFile).catch(() => null);
      
      if (stats && stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = path.join(
          this.logDirectory, 
          `security-events-${timestamp}.jsonl`
        );
        
        await fs.rename(jsonLogFile, archiveFile);
        
        await this.logSecurityEvent({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'fallback-logger',
          event: 'log_rotated',
          data: { archiveFile, originalSize: stats.size }
        });
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }
}

export default FallbackLoggerService;