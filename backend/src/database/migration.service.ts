import { DatabaseService } from './database.service';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../shared/logger';

export interface Migration {
  id: string;
  filename: string;
  executed_at: Date;
}

export class MigrationService {
  private databaseService: DatabaseService;
  private migrationsPath: string;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.migrationsPath = join(__dirname, 'migrations');
  }

  /**
   * Initialize the migrations table
   */
  async initializeMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON migrations(executed_at);
    `;

    try {
      await this.databaseService.query(createTableQuery);
      logger.info('Migrations table initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize migrations table:', error);
      throw error;
    }
  }

  /**
   * Get all executed migrations from database
   */
  async getExecutedMigrations(): Promise<Migration[]> {
    try {
      const result = await this.databaseService.query(
        'SELECT id, filename, executed_at FROM migrations ORDER BY executed_at ASC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      throw error;
    }
  }

  /**
   * Get all migration files from filesystem
   */
  getMigrationFiles(): string[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
      return files;
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw error;
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename: string): Promise<void> {
    const migrationPath = join(this.migrationsPath, filename);
    const migrationId = filename.replace('.sql', '');

    try {
      // Read migration file
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Execute migration in a transaction
      await this.databaseService.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migrationSQL);

        // Record the migration as executed
        await client.query(
          'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
          [migrationId, filename]
        );
      });

      logger.info(`Migration ${filename} executed successfully`);
    } catch (error) {
      logger.error(`Failed to execute migration ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      // Initialize migrations table
      await this.initializeMigrationsTable();

      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      const executedIds = new Set(executedMigrations.map(m => m.id));

      // Get all migration files
      const migrationFiles = this.getMigrationFiles();

      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(file => {
        const migrationId = file.replace('.sql', '');
        return !executedIds.has(migrationId);
      });

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to execute');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      logger.info('All migrations executed successfully');
    } catch (error) {
      logger.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Rollback the last migration (for development use)
   */
  async rollbackLastMigration(): Promise<void> {
    try {
      const executedMigrations = await this.getExecutedMigrations();
      
      if (executedMigrations.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }

      const lastMigration = executedMigrations[executedMigrations.length - 1];
      
      // Remove from migrations table
      await this.databaseService.query(
        'DELETE FROM migrations WHERE id = $1',
        [lastMigration.id]
      );

      logger.warn(`Rolled back migration: ${lastMigration.filename}`);
      logger.warn('Note: This only removes the migration record. Manual cleanup of schema changes may be required.');
    } catch (error) {
      logger.error('Failed to rollback migration:', error);
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{
    executed: Migration[];
    pending: string[];
    total: number;
  }> {
    try {
      const executedMigrations = await this.getExecutedMigrations();
      const allMigrationFiles = this.getMigrationFiles();
      const executedIds = new Set(executedMigrations.map(m => m.id));
      
      const pendingMigrations = allMigrationFiles.filter(file => {
        const migrationId = file.replace('.sql', '');
        return !executedIds.has(migrationId);
      });

      return {
        executed: executedMigrations,
        pending: pendingMigrations,
        total: allMigrationFiles.length
      };
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }
}