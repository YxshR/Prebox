import { DatabaseService } from '../database/database.service';
import { User, UserRole, SubscriptionTier, ApiResponse } from '../shared/types';

export interface AdminUserFilters {
  role?: UserRole;
  subscriptionTier?: SubscriptionTier;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersByTier: Record<SubscriptionTier, number>;
  usersByRole: Record<UserRole, number>;
}

export class AdminUserService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async getUsers(filters: AdminUserFilters = {}): Promise<ApiResponse<User[]>> {
    const {
      role,
      subscriptionTier,
      isEmailVerified,
      isPhoneVerified,
      search,
      page = 1,
      limit = 20
    } = filters;

    let query = `
      SELECT u.*, t.name as tenant_name,
             s.status as subscription_status,
             s.current_period_end as subscription_end
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN subscriptions s ON u.tenant_id = s.tenant_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (subscriptionTier) {
      query += ` AND u.subscription_tier = $${paramIndex}`;
      params.push(subscriptionTier);
      paramIndex++;
    }

    if (isEmailVerified !== undefined) {
      query += ` AND u.is_email_verified = $${paramIndex}`;
      params.push(isEmailVerified);
      paramIndex++;
    }

    if (isPhoneVerified !== undefined) {
      query += ` AND u.is_phone_verified = $${paramIndex}`;
      params.push(isPhoneVerified);
      paramIndex++;
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT u.*, t.name as tenant_name, s.status as subscription_status, s.current_period_end as subscription_end',
      'SELECT COUNT(*)'
    );
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const users = result.rows.map(this.mapDbUserToUser);

    return {
      success: true,
      data: users,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  async getUserById(userId: string): Promise<User> {
    const result = await this.db.query(
      `SELECT u.*, t.name as tenant_name,
              s.status as subscription_status,
              s.current_period_end as subscription_end,
              s.usage as subscription_usage
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       LEFT JOIN subscriptions s ON u.tenant_id = s.tenant_id
       WHERE u.id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      throw new Error('User not found');
    }

    return this.mapDbUserToUser(result.rows[0]);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const allowedFields = ['email', 'firstName', 'lastName', 'role', 'subscriptionTier', 'isEmailVerified', 'isPhoneVerified'];
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = this.mapFieldToDb(key);
      if (allowedFields.includes(key) && dbField) {
        updateFields.push(`${dbField} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(userId);
    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (!result.rows.length) {
      throw new Error('User not found');
    }

    return this.mapDbUserToUser(result.rows[0]);
  }

  async deleteUser(userId: string): Promise<void> {
    // Start transaction
    await this.db.query('BEGIN');

    try {
      // Get user's tenant
      const userResult = await this.db.query('SELECT tenant_id FROM users WHERE id = $1', [userId]);
      if (!userResult.rows.length) {
        throw new Error('User not found');
      }

      const tenantId = userResult.rows[0].tenant_id;

      // Delete related data
      await this.db.query('DELETE FROM api_keys WHERE user_id = $1', [userId]);
      await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      await this.db.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
      await this.db.query('DELETE FROM otp_verifications WHERE user_id = $1', [userId]);

      // Delete user
      await this.db.query('DELETE FROM users WHERE id = $1', [userId]);

      // Check if tenant has other users, if not delete tenant
      const remainingUsers = await this.db.query('SELECT COUNT(*) FROM users WHERE tenant_id = $1', [tenantId]);
      if (parseInt(remainingUsers.rows[0].count) === 0) {
        await this.db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      }

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async getUserStats(): Promise<UserStats> {
    const queries = [
      // Total users
      'SELECT COUNT(*) as total FROM users',
      
      // Active users (logged in within last 30 days)
      'SELECT COUNT(*) as active FROM users WHERE last_login_at > NOW() - INTERVAL \'30 days\'',
      
      // New users today
      'SELECT COUNT(*) as today FROM users WHERE created_at >= CURRENT_DATE',
      
      // New users this week
      'SELECT COUNT(*) as week FROM users WHERE created_at >= DATE_TRUNC(\'week\', NOW())',
      
      // New users this month
      'SELECT COUNT(*) as month FROM users WHERE created_at >= DATE_TRUNC(\'month\', NOW())',
      
      // Users by tier
      'SELECT subscription_tier, COUNT(*) as count FROM users GROUP BY subscription_tier',
      
      // Users by role
      'SELECT role, COUNT(*) as count FROM users GROUP BY role'
    ];

    const results = await Promise.all(queries.map(query => this.db.query(query)));

    const usersByTier = results[5].rows.reduce((acc, row) => {
      acc[row.subscription_tier as SubscriptionTier] = parseInt(row.count);
      return acc;
    }, {} as Record<SubscriptionTier, number>);

    const usersByRole = results[6].rows.reduce((acc, row) => {
      acc[row.role as UserRole] = parseInt(row.count);
      return acc;
    }, {} as Record<UserRole, number>);

    return {
      totalUsers: parseInt(results[0].rows[0].total),
      activeUsers: parseInt(results[1].rows[0].active),
      newUsersToday: parseInt(results[2].rows[0].today),
      newUsersThisWeek: parseInt(results[3].rows[0].week),
      newUsersThisMonth: parseInt(results[4].rows[0].month),
      usersByTier,
      usersByRole
    };
  }

  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      phone: dbUser.phone,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      tenantId: dbUser.tenant_id,
      role: dbUser.role as UserRole,
      subscriptionTier: dbUser.subscription_tier as SubscriptionTier,
      isEmailVerified: dbUser.is_email_verified,
      isPhoneVerified: dbUser.is_phone_verified,
      googleId: dbUser.google_id,
      createdAt: dbUser.created_at,
      lastLoginAt: dbUser.last_login_at
    };
  }

  private mapFieldToDb(field: string): string | null {
    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      subscriptionTier: 'subscription_tier',
      isEmailVerified: 'is_email_verified',
      isPhoneVerified: 'is_phone_verified'
    };

    return fieldMap[field] || (field === 'email' || field === 'role' ? field : null);
  }
}