import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import winston from 'winston';

export interface MigrationResult {
  success: boolean;
  migrationsRun: string[];
  errors: string[];
  totalTime: number;
}

export class MigrationRunner {
  private db: Pool;
  private logger: winston.Logger;
  private migrationsPath: string;

  constructor(db: Pool, logger: winston.Logger, migrationsPath?: string) {
    this.db = db;
    this.logger = logger;
    this.migrationsPath = migrationsPath || join(__dirname, 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT true
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at);
    `;

    await this.db.query(sql);
    this.logger.info('Migration tracking table initialized');
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations(): Promise<string[]> {
    try {
      // Get all migration files
      const migrationFiles = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Get executed migrations
      const result = await this.db.query(
        'SELECT filename FROM schema_migrations WHERE success = true'
      );
      const executedMigrations = new Set(result.rows.map(row => row.filename));

      // Return pending migrations
      return migrationFiles.filter(file => !executedMigrations.has(file));
    } catch (error: any) {
      this.logger.error('Failed to get pending migrations', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename: string): Promise<{ success: boolean; executionTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const filePath = join(this.migrationsPath, filename);
      const content = readFileSync(filePath, 'utf8');
      const checksum = this.calculateChecksum(content);

      this.logger.info(`Executing migration: ${filename}`);

      // Start transaction
      await this.db.query('BEGIN');

      try {
        // Execute migration SQL
        await this.db.query(content);

        // Record successful migration
        const executionTime = Date.now() - startTime;
        await this.db.query(
          `INSERT INTO schema_migrations (filename, checksum, execution_time_ms, success) 
           VALUES ($1, $2, $3, $4)`,
          [filename, checksum, executionTime, true]
        );

        await this.db.query('COMMIT');

        this.logger.info(`Migration completed: ${filename} (${executionTime}ms)`);
        return { success: true, executionTime };

      } catch (migrationError: any) {
        await this.db.query('ROLLBACK');

        // Record failed migration
        const executionTime = Date.now() - startTime;
        await this.db.query(
          `INSERT INTO schema_migrations (filename, checksum, execution_time_ms, success) 
           VALUES ($1, $2, $3, $4)`,
          [filename, checksum, executionTime, false]
        );

        throw migrationError;
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Migration failed: ${filename}`, { 
        error: error.message, 
        executionTime 
      });
      
      return { 
        success: false, 
        executionTime, 
        error: error.message 
      };
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<MigrationResult> {
    const startTime = Date.now();
    const migrationsRun: string[] = [];
    const errors: string[] = [];

    try {
      // Initialize migration table
      await this.initializeMigrationTable();

      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        this.logger.info('No pending migrations to run');
        return {
          success: true,
          migrationsRun: [],
          errors: [],
          totalTime: Date.now() - startTime
        };
      }

      this.logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Execute migrations in order
      for (const migration of pendingMigrations) {
        const result = await this.executeMigration(migration);
        
        if (result.success) {
          migrationsRun.push(migration);
        } else {
          errors.push(`${migration}: ${result.error}`);
          // Stop on first error to maintain consistency
          break;
        }
      }

      const totalTime = Date.now() - startTime;
      const success = errors.length === 0;

      if (success) {
        this.logger.info(`All migrations completed successfully`, {
          migrationsRun: migrationsRun.length,
          totalTime
        });
      } else {
        this.logger.error(`Migration process failed`, {
          migrationsRun: migrationsRun.length,
          errors: errors.length,
          totalTime
        });
      }

      return {
        success,
        migrationsRun,
        errors,
        totalTime
      };

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      this.logger.error('Migration process failed with unexpected error', { 
        error: error.message,
        totalTime
      });

      return {
        success: false,
        migrationsRun,
        errors: [error.message],
        totalTime
      };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    totalMigrations: number;
    executedMigrations: number;
    pendingMigrations: number;
    lastMigration?: { filename: string; executedAt: Date };
  }> {
    try {
      // Get all migration files
      const migrationFiles = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'));

      // Get executed migrations
      const result = await this.db.query(`
        SELECT filename, executed_at 
        FROM schema_migrations 
        WHERE success = true 
        ORDER BY executed_at DESC 
        LIMIT 1
      `);

      const executedResult = await this.db.query(
        'SELECT COUNT(*) as count FROM schema_migrations WHERE success = true'
      );

      const executedCount = parseInt(executedResult.rows[0].count);
      const pendingCount = migrationFiles.length - executedCount;

      return {
        totalMigrations: migrationFiles.length,
        executedMigrations: executedCount,
        pendingMigrations: pendingCount,
        lastMigration: result.rows.length > 0 ? {
          filename: result.rows[0].filename,
          executedAt: result.rows[0].executed_at
        } : undefined
      };

    } catch (error: any) {
      this.logger.error('Failed to get migration status', { error: error.message });
      throw error;
    }
  }

  /**
   * Rollback last migration (if supported)
   */
  async rollbackLastMigration(): Promise<{ success: boolean; rolledBack?: string; error?: string }> {
    try {
      // Get last executed migration
      const result = await this.db.query(`
        SELECT filename, checksum 
        FROM schema_migrations 
        WHERE success = true 
        ORDER BY executed_at DESC 
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return { success: false, error: 'No migrations to rollback' };
      }

      const lastMigration = result.rows[0].filename;
      
      // Check if rollback file exists
      const rollbackFile = lastMigration.replace('.sql', '.rollback.sql');
      const rollbackPath = join(this.migrationsPath, rollbackFile);

      try {
        const rollbackContent = readFileSync(rollbackPath, 'utf8');
        
        // Execute rollback
        await this.db.query('BEGIN');
        await this.db.query(rollbackContent);
        
        // Remove migration record
        await this.db.query(
          'DELETE FROM schema_migrations WHERE filename = $1',
          [lastMigration]
        );
        
        await this.db.query('COMMIT');

        this.logger.info(`Rolled back migration: ${lastMigration}`);
        return { success: true, rolledBack: lastMigration };

      } catch (rollbackError: any) {
        await this.db.query('ROLLBACK');
        throw rollbackError;
      }

    } catch (error: any) {
      this.logger.error('Rollback failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}