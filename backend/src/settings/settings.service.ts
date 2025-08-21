import pool from '../config/database';

export interface UserSettings {
  emailNotifications: boolean;
  webhookUrl?: string;
  timezone: string;
  language: string;
}

export class SettingsService {
  
  /**
   * Get user settings
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    const result = await pool.query(`
      SELECT 
        email_notifications,
        webhook_url,
        timezone,
        language
      FROM user_settings 
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Return default settings if none exist
      return {
        emailNotifications: true,
        webhookUrl: '',
        timezone: 'UTC',
        language: 'en'
      };
    }

    const row = result.rows[0];
    return {
      emailNotifications: row.email_notifications,
      webhookUrl: row.webhook_url,
      timezone: row.timezone,
      language: row.language
    };
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if settings exist
      const existingResult = await client.query(
        'SELECT id FROM user_settings WHERE user_id = $1',
        [userId]
      );

      if (existingResult.rows.length === 0) {
        // Insert new settings
        await client.query(`
          INSERT INTO user_settings (user_id, email_notifications, webhook_url, timezone, language, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `, [
          userId,
          updates.emailNotifications ?? true,
          updates.webhookUrl ?? '',
          updates.timezone ?? 'UTC',
          updates.language ?? 'en'
        ]);
      } else {
        // Update existing settings
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (updates.emailNotifications !== undefined) {
          updateFields.push(`email_notifications = $${paramIndex++}`);
          updateValues.push(updates.emailNotifications);
        }

        if (updates.webhookUrl !== undefined) {
          updateFields.push(`webhook_url = $${paramIndex++}`);
          updateValues.push(updates.webhookUrl);
        }

        if (updates.timezone !== undefined) {
          updateFields.push(`timezone = $${paramIndex++}`);
          updateValues.push(updates.timezone);
        }

        if (updates.language !== undefined) {
          updateFields.push(`language = $${paramIndex++}`);
          updateValues.push(updates.language);
        }

        if (updateFields.length > 0) {
          updateFields.push(`updated_at = NOW()`);
          updateValues.push(userId);

          await client.query(`
            UPDATE user_settings 
            SET ${updateFields.join(', ')}
            WHERE user_id = $${paramIndex}
          `, updateValues);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}