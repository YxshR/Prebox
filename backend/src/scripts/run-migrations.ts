import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../config/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in alphabetical order

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      console.log(`⚡ Running migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`✅ Migration completed: ${file}`);
      } catch (error: any) {
        if (error.code === '42P07') {
          // Table already exists
          console.log(`⚠️  Migration skipped (already exists): ${file}`);
        } else {
          console.error(`❌ Migration failed: ${file}`, error.message);
          throw error;
        }
      }
    }

    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };