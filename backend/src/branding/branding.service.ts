import { Pool } from 'pg';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import {
  BrandingSettings,
  LogoUpload,
  LogoUploadResult,
  BrandingUpdateRequest,
  BrandingPreviewResult,
  BrandingValidationResult,
  TemplateWithBranding,
  LogoPosition,
  UploadStatus,
  LOGO_UPLOAD_CONFIG,
  DEFAULT_BRANDING_CONFIG
} from './branding.types';
import { SubscriptionTier } from '../shared/types';

export class BrandingService {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * Upload logo file and create logo upload record
   */
  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
    subscriptionTier: SubscriptionTier
  ): Promise<LogoUploadResult> {
    // Validate file
    const validation = this.validateLogoFile(file);
    if (!validation.isValid) {
      throw new Error(`Logo validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if user has logo customization access
    if (!this.hasLogoAccess(subscriptionTier)) {
      throw new Error('Logo customization is not available for your subscription tier');
    }

    const uploadId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const storedFilename = `${uploadId}${fileExtension}`;
    const uploadPath = path.join(LOGO_UPLOAD_CONFIG.uploadPath, tenantId);
    const filePath = path.join(uploadPath, storedFilename);

    try {
      // Ensure upload directory exists
      await fs.mkdir(uploadPath, { recursive: true });

      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Get image dimensions (simplified - in production, use sharp or similar)
      const dimensions = await this.getImageDimensions(file.buffer);

      // Create database record
      const logoUpload = await this.createLogoUploadRecord({
        id: uploadId,
        tenantId,
        originalFilename: file.originalname,
        storedFilename,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        width: dimensions?.width,
        height: dimensions?.height,
        uploadStatus: UploadStatus.COMPLETED
      });

      // Generate public URL (in production, use CDN or S3)
      const logoUrl = `/api/branding/logos/${tenantId}/${storedFilename}`;
      
      // Update branding settings with new logo
      await this.updateBrandingSettings(tenantId, { logoUrl });

      return {
        logoUrl,
        fileSize: file.size,
        dimensions: dimensions || undefined,
        uploadId
      };
    } catch (error) {
      // Mark upload as failed
      await this.updateLogoUploadStatus(uploadId, UploadStatus.FAILED);
      throw new Error(`Logo upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update branding settings for a tenant
   */
  async updateBrandingSettings(
    tenantId: string,
    updates: Partial<BrandingSettings>
  ): Promise<BrandingSettings> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get existing settings or create default
      let existingSettings = await this.getBrandingSettings(tenantId);
      
      if (!existingSettings) {
        existingSettings = await this.createDefaultBrandingSettings(tenantId);
      }

      // Validate updates
      const validation = this.validateBrandingSettings({ ...existingSettings, ...updates });
      if (!validation.isValid) {
        throw new Error(`Branding validation failed: ${validation.errors.join(', ')}`);
      }

      // Update settings
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'tenantId' && key !== 'createdAt') {
          const dbKey = this.camelToSnake(key);
          updateFields.push(`${dbKey} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        await client.query('COMMIT');
        return existingSettings;
      }

      updateValues.push(tenantId);
      const updateQuery = `
        UPDATE branding_settings 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $${paramIndex} AND is_active = true
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);
      await client.query('COMMIT');

      return this.mapDbToBrandingSettings(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get branding settings for a tenant
   */
  async getBrandingSettings(tenantId: string): Promise<BrandingSettings | null> {
    const query = `
      SELECT * FROM branding_settings 
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await this.db.query(query, [tenantId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbToBrandingSettings(result.rows[0]);
  }

  /**
   * Generate branding preview
   */
  async generateBrandingPreview(
    tenantId: string,
    settings: BrandingUpdateRequest,
    templateId?: string
  ): Promise<BrandingPreviewResult> {
    // Get current settings
    const currentSettings = await this.getBrandingSettings(tenantId) || 
                           await this.createDefaultBrandingSettings(tenantId);

    // Merge with preview settings
    const previewSettings = { ...currentSettings, ...settings };

    // Get template HTML (simplified - in production, fetch from template service)
    const templateHtml = templateId ? 
      await this.getTemplateHtml(templateId) : 
      this.getDefaultPreviewTemplate();

    // Apply branding to template
    const brandedHtml = await this.applyBrandingToTemplate(templateHtml, previewSettings);

    return {
      previewHtml: brandedHtml
    };
  }

  /**
   * Apply branding to email template
   */
  async applyBrandingToTemplate(
    templateHtml: string,
    brandingSettings: BrandingSettings
  ): Promise<string> {
    let brandedHtml = templateHtml;

    // Apply logo
    if (brandingSettings.logoUrl) {
      const logoHtml = this.generateLogoHtml(brandingSettings);
      brandedHtml = this.insertLogoIntoTemplate(brandedHtml, logoHtml, brandingSettings.logoPosition);
    }

    // Apply colors and fonts
    brandedHtml = this.applyColorAndFontStyles(brandedHtml, brandingSettings);

    // Apply custom CSS
    if (brandingSettings.customCss) {
      brandedHtml = this.applyCustomCss(brandedHtml, brandingSettings.customCss);
    }

    return brandedHtml;
  }

  /**
   * Delete logo and update branding settings
   */
  async deleteLogo(tenantId: string): Promise<void> {
    const settings = await this.getBrandingSettings(tenantId);
    
    if (settings?.logoUrl) {
      try {
        // Delete file from disk
        const logoPath = this.getLogoFilePath(settings.logoUrl, tenantId);
        await fs.unlink(logoPath);
      } catch (error) {
        console.warn(`Failed to delete logo file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Update branding settings
      await this.updateBrandingSettings(tenantId, { logoUrl: undefined });
    }
  }

  /**
   * Get logo upload history for tenant
   */
  async getLogoUploadHistory(tenantId: string): Promise<LogoUpload[]> {
    const query = `
      SELECT * FROM logo_uploads 
      WHERE tenant_id = $1 
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const result = await this.db.query(query, [tenantId]);
    return result.rows.map(row => this.mapDbToLogoUpload(row));
  }

  // Private helper methods

  private validateLogoFile(file: Express.Multer.File): BrandingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > LOGO_UPLOAD_CONFIG.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${LOGO_UPLOAD_CONFIG.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!LOGO_UPLOAD_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${LOGO_UPLOAD_CONFIG.allowedMimeTypes.join(', ')}`);
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    if (!LOGO_UPLOAD_CONFIG.allowedExtensions.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed. Allowed extensions: ${LOGO_UPLOAD_CONFIG.allowedExtensions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateBrandingSettings(settings: Partial<BrandingSettings>): BrandingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate colors (hex format)
    const colorFields = ['primaryColor', 'secondaryColor', 'textColor'];
    colorFields.forEach(field => {
      const color = settings[field as keyof BrandingSettings] as string;
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        errors.push(`${field} must be a valid hex color (e.g., #FF0000)`);
      }
    });

    // Validate logo position
    if (settings.logoPosition && !Object.values(LogoPosition).includes(settings.logoPosition)) {
      errors.push(`Logo position must be one of: ${Object.values(LogoPosition).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private hasLogoAccess(subscriptionTier: SubscriptionTier): boolean {
    return subscriptionTier !== SubscriptionTier.FREE;
  }

  private async createDefaultBrandingSettings(tenantId: string): Promise<BrandingSettings> {
    // This would typically get the user's subscription tier
    const defaultSettings = DEFAULT_BRANDING_CONFIG.free;
    
    const query = `
      INSERT INTO branding_settings (tenant_id, logo_position, primary_color, secondary_color, text_color, font_family)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      tenantId,
      defaultSettings.logoPosition,
      defaultSettings.primaryColor,
      defaultSettings.secondaryColor,
      defaultSettings.textColor,
      defaultSettings.fontFamily
    ];
    
    const result = await this.db.query(query, values);
    return this.mapDbToBrandingSettings(result.rows[0]);
  }

  private async createLogoUploadRecord(logoData: Omit<LogoUpload, 'createdAt'>): Promise<LogoUpload> {
    const query = `
      INSERT INTO logo_uploads (
        id, tenant_id, original_filename, stored_filename, file_path, 
        file_size, mime_type, width, height, thumbnail_url, upload_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      logoData.id,
      logoData.tenantId,
      logoData.originalFilename,
      logoData.storedFilename,
      logoData.filePath,
      logoData.fileSize,
      logoData.mimeType,
      logoData.width,
      logoData.height,
      logoData.thumbnailUrl,
      logoData.uploadStatus
    ];
    
    const result = await this.db.query(query, values);
    return this.mapDbToLogoUpload(result.rows[0]);
  }

  private async updateLogoUploadStatus(uploadId: string, status: UploadStatus): Promise<void> {
    const query = 'UPDATE logo_uploads SET upload_status = $1 WHERE id = $2';
    await this.db.query(query, [status, uploadId]);
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    // Simplified implementation - in production, use sharp or similar library
    // For now, return null and handle gracefully
    return null;
  }

  private generateLogoHtml(settings: BrandingSettings): string {
    return `
      <img src="${settings.logoUrl}" 
           alt="Logo" 
           style="max-width: 200px; max-height: 100px; object-fit: contain;" />
    `;
  }

  private insertLogoIntoTemplate(html: string, logoHtml: string, position: LogoPosition): string {
    // Simplified implementation - in production, use proper HTML parsing
    switch (position) {
      case LogoPosition.HEADER:
        return html.replace('<body>', `<body><div style="text-align: center; padding: 20px;">${logoHtml}</div>`);
      case LogoPosition.FOOTER:
        return html.replace('</body>', `<div style="text-align: center; padding: 20px;">${logoHtml}</div></body>`);
      case LogoPosition.SIDEBAR:
        return html.replace('<body>', `<body><div style="float: left; padding: 20px;">${logoHtml}</div>`);
      default:
        return html;
    }
  }

  private applyColorAndFontStyles(html: string, settings: BrandingSettings): string {
    const styles = `
      <style>
        body { 
          font-family: ${settings.fontFamily}; 
          color: ${settings.textColor}; 
        }
        .primary { color: ${settings.primaryColor}; }
        .secondary { color: ${settings.secondaryColor}; }
        .bg-primary { background-color: ${settings.primaryColor}; }
        .bg-secondary { background-color: ${settings.secondaryColor}; }
      </style>
    `;
    
    return html.replace('</head>', `${styles}</head>`);
  }

  private applyCustomCss(html: string, customCss: string): string {
    const styles = `<style>${customCss}</style>`;
    return html.replace('</head>', `${styles}</head>`);
  }

  private getDefaultPreviewTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Preview</title>
      </head>
      <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 class="primary">Welcome to Our Newsletter</h1>
          <p>This is a preview of how your branding will look in emails.</p>
          <div class="bg-secondary" style="padding: 20px; margin: 20px 0;">
            <p>This section uses your secondary background color.</p>
          </div>
          <p>Thank you for choosing our service!</p>
        </div>
      </body>
      </html>
    `;
  }

  private async getTemplateHtml(templateId: string): Promise<string> {
    // In production, this would fetch from the template service
    return this.getDefaultPreviewTemplate();
  }

  private getLogoFilePath(logoUrl: string, tenantId: string): string {
    const filename = path.basename(logoUrl);
    return path.join(LOGO_UPLOAD_CONFIG.uploadPath, tenantId, filename);
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private mapDbToBrandingSettings(row: any): BrandingSettings {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      logoUrl: row.logo_url,
      logoPosition: row.logo_position as LogoPosition,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      textColor: row.text_color,
      fontFamily: row.font_family,
      customCss: row.custom_css,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbToLogoUpload(row: any): LogoUpload {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      originalFilename: row.original_filename,
      storedFilename: row.stored_filename,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      thumbnailUrl: row.thumbnail_url,
      uploadStatus: row.upload_status as UploadStatus,
      createdAt: row.created_at
    };
  }
}

export const brandingService = new BrandingService();