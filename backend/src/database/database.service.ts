import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../shared/logger';

export class DatabaseService {
  private pool: Pool;
  private static instance: DatabaseService;
  private isClosing: boolean = false;

  constructor() {
    // Use environment variables with fallbacks
    const config = {
      host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'bulk_email_platform',
      user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
    };

    this.pool = new Pool(config);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    // Handle pool connection
    this.pool.on('connect', () => {
      logger.info('Database connection established');
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance || DatabaseService.instance.isClosing) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Execute a query with optional parameters
   */
  async query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms):`, { query: text.substring(0, 100) });
      }
      
      return result;
    } catch (error) {
      logger.error('Database query error:', { query: text.substring(0, 100), error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a database client for manual connection management
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      logger.info('Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingCount: number;
  }> {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    if (this.isClosing) {
      logger.debug('Database connection already closing, skipping...');
      return;
    }
    
    this.isClosing = true;
    
    try {
      await this.pool.end();
      logger.info('Database connections closed');
      // Reset the singleton instance so a new one can be created
      DatabaseService.instance = null as any;
    } catch (error) {
      logger.error('Error closing database connections:', error);
      throw error;
    }
  }
}