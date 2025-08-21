import pool from '../config/database';

export interface SecurityConfiguration {
  tenantId: string;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  sessionTimeoutMinutes: number;
  apiRateLimitPerMinute: number;
  enable2FA: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SecurityConfigService {
  /**
   * Get security configuration for tenant
   */
  async getConfiguration(tenantId: string): Promise<SecurityConfiguration> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM security_configurations WHERE tenant_id = $1
      `, [tenantId]);

      if (result.rows.length === 0) {
        // Create default configuration if none exists
        return await this.createDefaultConfiguration(tenantId);
      }

      const config = result.rows[0];
      return {
        tenantId: config.tenant_id,
        maxLoginAttempts: config.max_login_attempts,
        lockoutDurationMinutes: config.lockout_duration_minutes,
        passwordMinLength: config.password_min_length,
        passwordRequireUppercase: config.password_require_uppercase,
        passwordRequireLowercase: config.password_require_lowercase,
        passwordRequireNumbers: config.password_require_numbers,
        passwordRequireSymbols: config.password_require_symbols,
        sessionTimeoutMinutes: config.session_timeout_minutes,
        apiRateLimitPerMinute: config.api_rate_limit_per_minute,
        enable2FA: config.enable_2fa,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update security configuration
   */
  async updateConfiguration(
    tenantId: string, 
    updates: Partial<Omit<SecurityConfiguration, 'tenantId' | 'createdAt' | 'updatedAt'>>
  ): Promise<SecurityConfiguration> {
    const client = await pool.connect();
    
    try {
      const setClause = [];
      const values = [tenantId];
      let paramIndex = 2;

      if (updates.maxLoginAttempts !== undefined) {
        setClause.push(`max_login_attempts = $${paramIndex}`);
        values.push(updates.maxLoginAttempts);
        paramIndex++;
      }

      if (updates.lockoutDurationMinutes !== undefined) {
        setClause.push(`lockout_duration_minutes = $${paramIndex}`);
        values.push(updates.lockoutDurationMinutes);
        paramIndex++;
      }

      if (updates.passwordMinLength !== undefined) {
        setClause.push(`password_min_length = $${paramIndex}`);
        values.push(updates.passwordMinLength);
        paramIndex++;
      }

      if (updates.passwordRequireUppercase !== undefined) {
        setClause.push(`password_require_uppercase = $${paramIndex}`);
        values.push(updates.passwordRequireUppercase);
        paramIndex++;
      }

      if (updates.passwordRequireLowercase !== undefined) {
        setClause.push(`password_require_lowercase = $${paramIndex}`);
        values.push(updates.passwordRequireLowercase);
        paramIndex++;
      }

      if (updates.passwordRequireNumbers !== undefined) {
        setClause.push(`password_require_numbers = $${paramIndex}`);
        values.push(updates.passwordRequireNumbers);
        paramIndex++;
      }

      if (updates.passwordRequireSymbols !== undefined) {
        setClause.push(`password_require_symbols = $${paramIndex}`);
        values.push(updates.passwordRequireSymbols);
        paramIndex++;
      }

      if (updates.sessionTimeoutMinutes !== undefined) {
        setClause.push(`session_timeout_minutes = $${paramIndex}`);
        values.push(updates.sessionTimeoutMinutes);
        paramIndex++;
      }

      if (updates.apiRateLimitPerMinute !== undefined) {
        setClause.push(`api_rate_limit_per_minute = $${paramIndex}`);
        values.push(updates.apiRateLimitPerMinute);
        paramIndex++;
      }

      if (updates.enable2FA !== undefined) {
        setClause.push(`enable_2fa = $${paramIndex}`);
        values.push(updates.enable2FA);
        paramIndex++;
      }

      if (setClause.length === 0) {
        throw new Error('No updates provided');
      }

      setClause.push('updated_at = NOW()');

      const query = `
        UPDATE security_configurations 
        SET ${setClause.join(', ')}
        WHERE tenant_id = $1
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Security configuration not found');
      }

      const config = result.rows[0];
      return {
        tenantId: config.tenant_id,
        maxLoginAttempts: config.max_login_attempts,
        lockoutDurationMinutes: config.lockout_duration_minutes,
        passwordMinLength: config.password_min_length,
        passwordRequireUppercase: config.password_require_uppercase,
        passwordRequireLowercase: config.password_require_lowercase,
        passwordRequireNumbers: config.password_require_numbers,
        passwordRequireSymbols: config.password_require_symbols,
        sessionTimeoutMinutes: config.session_timeout_minutes,
        apiRateLimitPerMinute: config.api_rate_limit_per_minute,
        enable2FA: config.enable_2fa,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create default security configuration
   */
  private async createDefaultConfiguration(tenantId: string): Promise<SecurityConfiguration> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO security_configurations (
          tenant_id, max_login_attempts, lockout_duration_minutes,
          password_min_length, password_require_uppercase, password_require_lowercase,
          password_require_numbers, password_require_symbols, session_timeout_minutes,
          api_rate_limit_per_minute, enable_2fa
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        tenantId,
        5,      // maxLoginAttempts
        15,     // lockoutDurationMinutes
        8,      // passwordMinLength
        true,   // passwordRequireUppercase
        true,   // passwordRequireLowercase
        true,   // passwordRequireNumbers
        false,  // passwordRequireSymbols
        60,     // sessionTimeoutMinutes
        100,    // apiRateLimitPerMinute
        false   // enable2FA
      ]);

      const config = result.rows[0];
      return {
        tenantId: config.tenant_id,
        maxLoginAttempts: config.max_login_attempts,
        lockoutDurationMinutes: config.lockout_duration_minutes,
        passwordMinLength: config.password_min_length,
        passwordRequireUppercase: config.password_require_uppercase,
        passwordRequireLowercase: config.password_require_lowercase,
        passwordRequireNumbers: config.password_require_numbers,
        passwordRequireSymbols: config.password_require_symbols,
        sessionTimeoutMinutes: config.session_timeout_minutes,
        apiRateLimitPerMinute: config.api_rate_limit_per_minute,
        enable2FA: config.enable_2fa,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate password against security policy
   */
  async validatePassword(tenantId: string, password: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const config = await this.getConfiguration(tenantId);
    const errors: string[] = [];

    // Check minimum length
    if (password.length < config.passwordMinLength) {
      errors.push(`Password must be at least ${config.passwordMinLength} characters long`);
    }

    // Check uppercase requirement
    if (config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (config.passwordRequireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check numbers requirement
    if (config.passwordRequireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check symbols requirement
    if (config.passwordRequireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if account should be locked due to failed attempts
   */
  async shouldLockAccount(tenantId: string, failedAttempts: number): Promise<boolean> {
    const config = await this.getConfiguration(tenantId);
    return failedAttempts >= config.maxLoginAttempts;
  }

  /**
   * Get lockout duration for tenant
   */
  async getLockoutDuration(tenantId: string): Promise<number> {
    const config = await this.getConfiguration(tenantId);
    return config.lockoutDurationMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Get session timeout for tenant
   */
  async getSessionTimeout(tenantId: string): Promise<number> {
    const config = await this.getConfiguration(tenantId);
    return config.sessionTimeoutMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Get API rate limit for tenant
   */
  async getApiRateLimit(tenantId: string): Promise<number> {
    const config = await this.getConfiguration(tenantId);
    return config.apiRateLimitPerMinute;
  }

  /**
   * Check if 2FA is enabled for tenant
   */
  async is2FAEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getConfiguration(tenantId);
    return config.enable2FA;
  }

  /**
   * Get all security configurations (admin only)
   */
  async getAllConfigurations(): Promise<SecurityConfiguration[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM security_configurations ORDER BY created_at DESC
      `);

      return result.rows.map(config => ({
        tenantId: config.tenant_id,
        maxLoginAttempts: config.max_login_attempts,
        lockoutDurationMinutes: config.lockout_duration_minutes,
        passwordMinLength: config.password_min_length,
        passwordRequireUppercase: config.password_require_uppercase,
        passwordRequireLowercase: config.password_require_lowercase,
        passwordRequireNumbers: config.password_require_numbers,
        passwordRequireSymbols: config.password_require_symbols,
        sessionTimeoutMinutes: config.session_timeout_minutes,
        apiRateLimitPerMinute: config.api_rate_limit_per_minute,
        enable2FA: config.enable_2fa,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Reset security configuration to defaults
   */
  async resetToDefaults(tenantId: string): Promise<SecurityConfiguration> {
    const client = await pool.connect();
    
    try {
      await client.query(`DELETE FROM security_configurations WHERE tenant_id = $1`, [tenantId]);
      return await this.createDefaultConfiguration(tenantId);
    } finally {
      client.release();
    }
  }
}