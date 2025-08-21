import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Use DATABASE_URL if available, otherwise fall back to individual parameters
const databaseUrl = process.env.DATABASE_URL;

let poolConfig: any;

if (databaseUrl) {
  // Use connection string (for Neon and other cloud providers)
  poolConfig = {
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased for cloud connections
    application_name: 'bulk-email-platform',
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
  };
  
  // Add SSL for production or cloud databases
  if (process.env.NODE_ENV === 'production' || databaseUrl.includes('neon.tech')) {
    poolConfig.ssl = { rejectUnauthorized: false }; // Neon requires SSL but with self-signed certs
  }
} else {
  // Fall back to individual parameters for local development
  const sslConfig = process.env.NODE_ENV === 'production' ? {
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA ? fs.readFileSync(process.env.DB_SSL_CA) : undefined,
      cert: process.env.DB_SSL_CERT ? fs.readFileSync(process.env.DB_SSL_CERT) : undefined,
      key: process.env.DB_SSL_KEY ? fs.readFileSync(process.env.DB_SSL_KEY) : undefined,
    }
  } : {};

  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bulk_email_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ...sslConfig,
    application_name: 'bulk-email-platform',
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
  };
}

const pool = new Pool(poolConfig);

export default pool;

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});