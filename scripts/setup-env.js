#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script helps developers set up their environment files
 * by copying .env.example files and providing guidance.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class EnvSetup {
  constructor() {
    this.projectRoot = process.cwd();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Main setup function
   */
  async setup() {
    console.log('🚀 Environment Setup Wizard');
    console.log('='.repeat(40));
    console.log('This wizard will help you set up your environment files.\n');

    try {
      await this.setupEnvironmentFiles();
      console.log('\n✅ Environment setup completed!');
      console.log('\n📝 Next steps:');
      console.log('1. Update the .env files with your actual configuration values');
      console.log('2. Never commit .env files to Git');
      console.log('3. Use .env.example files to document required variables');
      console.log('4. Run "npm run validate:env" to check your configuration');
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Set up environment files for all applications
   */
  async setupEnvironmentFiles() {
    const applications = [
      {
        name: 'Frontend',
        envPath: 'frontend/.env',
        examplePath: 'frontend/.env.example',
        description: 'Next.js frontend application'
      },
      {
        name: 'Backend',
        envPath: 'backend/.env',
        examplePath: 'backend/.env.example',
        description: 'Node.js backend API'
      },
      {
        name: 'Admin Frontend',
        envPath: 'admin-frontend/.env',
        examplePath: 'admin-frontend/.env.example',
        description: 'Admin dashboard application'
      }
    ];

    for (const app of applications) {
      await this.setupApplicationEnv(app);
    }
  }

  /**
   * Set up environment file for a specific application
   */
  async setupApplicationEnv({ name, envPath, examplePath, description }) {
    console.log(`\n📁 Setting up ${name} (${description})`);
    console.log('-'.repeat(40));

    const fullEnvPath = path.join(this.projectRoot, envPath);
    const fullExamplePath = path.join(this.projectRoot, examplePath);

    // Check if .env.example exists
    if (!fs.existsSync(fullExamplePath)) {
      console.log(`❌ Missing ${examplePath} file`);
      return;
    }

    // Check if .env already exists
    if (fs.existsSync(fullEnvPath)) {
      const overwrite = await this.askQuestion(
        `⚠️  ${envPath} already exists. Overwrite? (y/N): `
      );
      
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log(`⏭️  Skipping ${name}`);
        return;
      }
    }

    // Copy .env.example to .env
    try {
      const exampleContent = fs.readFileSync(fullExamplePath, 'utf8');
      fs.writeFileSync(fullEnvPath, exampleContent);
      console.log(`✅ Created ${envPath} from ${examplePath}`);

      // Provide specific guidance for each application
      this.provideSetupGuidance(name, exampleContent);

    } catch (error) {
      console.error(`❌ Failed to create ${envPath}:`, error.message);
    }
  }

  /**
   * Provide setup guidance for specific applications
   */
  provideSetupGuidance(appName, envContent) {
    console.log(`\n💡 ${appName} Configuration Tips:`);

    switch (appName) {
      case 'Frontend':
        console.log('   • Update NEXT_PUBLIC_GOOGLE_CLIENT_ID with your Google OAuth client ID');
        console.log('   • Ensure NEXT_PUBLIC_API_URL points to your backend (default: http://localhost:8000/api)');
        break;

      case 'Backend':
        console.log('   • Set up your database connection in DATABASE_URL');
        console.log('   • Configure Redis connection in REDIS_URL');
        console.log('   • Add your email service API keys (SendGrid, etc.)');
        console.log('   • Set up Google OAuth credentials');
        console.log('   • Configure payment gateway keys (Stripe, Razorpay)');
        console.log('   • Add AI service API keys if using AI features');
        
        if (envContent.includes('JWT_SECRET')) {
          console.log('   • Generate secure JWT secrets for production');
        }
        break;

      case 'Admin Frontend':
        console.log('   • Ensure NEXT_PUBLIC_API_URL matches your backend URL');
        break;
    }
  }

  /**
   * Ask a question and return the answer
   */
  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Generate a secure random string for secrets
   */
  generateSecureSecret(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Check if running in development environment
   */
  isDevelopment() {
    return process.env.NODE_ENV !== 'production';
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  const setup = new EnvSetup();
  setup.setup().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = EnvSetup;