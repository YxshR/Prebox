import express from 'express';
import multer from 'multer';
import path from 'path';
import { brandingService } from './branding.service';
import { validateRequest, validateQuery } from '../shared/validation.middleware';
import { AuthMiddleware } from '../auth/auth.middleware';

const authMiddleware = new AuthMiddleware().authenticate;
import {
  logoUploadSchema,
  brandingUpdateSchema,
  brandingPreviewSchema,
  brandingQuerySchema,
  LOGO_FILE_VALIDATION
} from './branding.validation';
import { ApiResponse } from '../shared/types';

const router = express.Router();

// Configure multer for logo uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: LOGO_FILE_VALIDATION.fileSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (!LOGO_FILE_VALIDATION.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!LOGO_FILE_VALIDATION.allowedExtensions.includes(ext)) {
      return cb(new Error(`File extension ${ext} is not allowed`));
    }
    
    cb(null, true);
  }
});

/**
 * @route POST /api/branding/logo
 * @desc Upload logo for tenant
 * @access Private (Paid Standard, Premium, Enterprise only)
 */
router.post('/logo', 
  authMiddleware,
  upload.single('logo'),
  validateRequest(logoUploadSchema),
  async (req: any, res: express.Response) => {
    try {
      if (!req.file) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No logo file was uploaded'
          }
        };
        return res.status(400).json(response);
      }

      const result = await brandingService.uploadLogo(
        req.user.tenantId,
        req.file,
        req.user.subscriptionTier
      );

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Logo uploaded successfully',
          logo: result
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Logo upload error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LOGO_UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to upload logo'
        }
      };

      res.status(400).json(response);
    }
  }
);

/**
 * @route GET /api/branding/settings
 * @desc Get branding settings for tenant
 * @access Private
 */
router.get('/settings',
  authMiddleware,
  validateQuery(brandingQuerySchema),
  async (req: any, res: express.Response) => {
    try {
      const settings = await brandingService.getBrandingSettings(req.user.tenantId);
      
      let logoHistory = null;
      if (req.query.includeHistory) {
        logoHistory = await brandingService.getLogoUploadHistory(req.user.tenantId);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          settings,
          logoHistory
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get branding settings error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FETCH_SETTINGS_FAILED',
          message: 'Failed to fetch branding settings'
        }
      };

      res.status(500).json(response);
    }
  }
);

/**
 * @route PUT /api/branding/settings
 * @desc Update branding settings for tenant
 * @access Private
 */
router.put('/settings',
  authMiddleware,
  validateRequest(brandingUpdateSchema),
  async (req: any, res: express.Response) => {
    try {
      const updatedSettings = await brandingService.updateBrandingSettings(
        req.user.tenantId,
        req.body
      );

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Branding settings updated successfully',
          settings: updatedSettings
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Update branding settings error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UPDATE_SETTINGS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update branding settings'
        }
      };

      res.status(400).json(response);
    }
  }
);

/**
 * @route POST /api/branding/preview
 * @desc Generate branding preview
 * @access Private
 */
router.post('/preview',
  authMiddleware,
  validateRequest(brandingPreviewSchema),
  async (req: any, res: express.Response) => {
    try {
      const { settings, templateId } = req.body;
      
      const preview = await brandingService.generateBrandingPreview(
        req.user.tenantId,
        settings,
        templateId
      );

      const response: ApiResponse = {
        success: true,
        data: {
          preview
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Generate branding preview error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'PREVIEW_GENERATION_FAILED',
          message: 'Failed to generate branding preview'
        }
      };

      res.status(500).json(response);
    }
  }
);

/**
 * @route DELETE /api/branding/logo
 * @desc Delete logo for tenant
 * @access Private
 */
router.delete('/logo',
  authMiddleware,
  async (req: any, res: express.Response) => {
    try {
      await brandingService.deleteLogo(req.user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Logo deleted successfully'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Delete logo error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DELETE_LOGO_FAILED',
          message: 'Failed to delete logo'
        }
      };

      res.status(500).json(response);
    }
  }
);

/**
 * @route GET /api/branding/logos/:tenantId/:filename
 * @desc Serve logo files
 * @access Public (with proper validation)
 */
router.get('/logos/:tenantId/:filename',
  async (req: express.Request, res: express.Response) => {
    try {
      const { tenantId, filename } = req.params;
      
      // Validate filename to prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILENAME',
            message: 'Invalid filename'
          }
        });
      }

      const logoPath = path.join(process.cwd(), 'uploads', 'logos', tenantId, filename);
      
      // Set appropriate headers
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      res.setHeader('Content-Type', 'image/*');
      
      res.sendFile(logoPath, (err) => {
        if (err) {
          res.status(404).json({
            success: false,
            error: {
              code: 'LOGO_NOT_FOUND',
              message: 'Logo file not found'
            }
          });
        }
      });
    } catch (error) {
      console.error('Serve logo error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVE_LOGO_FAILED',
          message: 'Failed to serve logo file'
        }
      });
    }
  }
);

/**
 * @route GET /api/branding/history
 * @desc Get logo upload history for tenant
 * @access Private
 */
router.get('/history',
  authMiddleware,
  validateQuery(brandingQuerySchema),
  async (req: any, res: express.Response) => {
    try {
      const history = await brandingService.getLogoUploadHistory(req.user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: {
          history
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get logo history error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FETCH_HISTORY_FAILED',
          message: 'Failed to fetch logo upload history'
        }
      };

      res.status(500).json(response);
    }
  }
);

export { router as brandingRoutes };