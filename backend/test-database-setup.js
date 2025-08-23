#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🧪 Testing Database Setup for Authentication System...\n');

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'bulk_email_platform',
  user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
};

console.log('📋 Database Configuration:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);
console.log('');

async function testDatabaseSetup() {
  const pool = new Pool(dbConfig);
  
  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Basic query successful');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    client.release();
    
    // Check if migrations table exists
    console.log('\n📊 Checking database schema...');
    const migrationCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    
    if (migrationCheck.rows[0].exists) {
      console.log('✅ Migrations table exists');
      
      // Check executed migrations
      const migrations = await pool.query('SELECT id, filename, executed_at FROM migrations ORDER BY executed_at');
      console.log(`   Executed migrations: ${migrations.rows.length}`);
      migrations.rows.forEach(m => {
        console.log(`   - ${m.id} (${m.executed_at.toISOString()})`);
      });
    } else {
      console.log('⚠️  Migrations table does not exist');
    }
    
    // Check auth tables
    const authTables = ['users', 'phone_verifications', 'email_verifications', 'auth0_profiles', 'user_sessions', 'pricing_plans'];
    console.log('\n🔍 Checking authentication tables...');
    
    for (const tableName of authTables) {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      if (tableCheck.rows[0].exists) {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`✅ ${tableName} table exists (${countResult.rows[0].count} rows)`);
      } else {
        console.log(`❌ ${tableName} table missing`);
      }
    }
    
    // Test environment variables
    console.log('\n🔧 Checking environment configuration...');
    
    const requiredVars = [
      'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'
    ];
    
    const optionalVars = [
      'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_DOMAIN',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
      'SENDGRID_API_KEY', 'JWT_SECRET'
    ];
    
    requiredVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`✅ ${varName} is set`);
      } else {
        console.log(`❌ ${varName} is missing (required)`);
      }
    });
    
    optionalVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`✅ ${varName} is set`);
      } else {
        console.log(`⚠️  ${varName} is not set (optional)`);
      }
    });
    
    console.log('\n🎉 Database setup test completed!');
    
  } catch (error) {
    console.error('\n❌ Database setup test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Troubleshooting tips:');
      console.log('1. Make sure PostgreSQL is running');
      console.log('2. Check if the database exists');
      console.log('3. Verify connection credentials in .env file');
    } else if (error.code === '28P01') {
      console.log('\n🔧 Authentication failed:');
      console.log('1. Check username and password in .env file');
      console.log('2. Verify user has access to the database');
    } else if (error.code === '3D000') {
      console.log('\n🔧 Database does not exist:');
      console.log('1. Create the database first');
      console.log('2. Or update DATABASE_NAME in .env file');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function runMigration() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🚀 Running database migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/001_create_auth_tables.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error('Migration file not found: ' + migrationPath);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await pool.query(migrationSQL);
    console.log('✅ Migration executed successfully');
    
    // Create migrations table and record
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      INSERT INTO migrations (id, filename) 
      VALUES ('001_create_auth_tables', '001_create_auth_tables.sql')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('✅ Migration recorded in migrations table');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'test':
    testDatabaseSetup();
    break;
  case 'migrate':
    runMigration().then(() => {
      console.log('🎉 Migration completed successfully!');
    }).catch(error => {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    });
    break;
  case 'setup':
    runMigration().then(() => {
      return testDatabaseSetup();
    }).catch(error => {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    });
    break;
  default:
    console.log('Usage: node test-database-setup.js [test|migrate|setup]');
    console.log('  test    - Test database connection and check schema');
    console.log('  migrate - Run database migrations');
    console.log('  setup   - Run migrations and test setup');
    process.exit(1);
}