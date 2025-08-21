import { Request, Response, NextFunction } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { UserRole } from '../shared/types';

export class AdminAuthMiddleware {
  private adminAuthService: AdminAuthService;

  constructor() {
    this.adminAuthService = new AdminAuthService();
  }

  authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin authentication required'
          }
        });
      }

      const token = authHeader.substring(7);
      const user = await this.adminAuthService.validateToken(token);

      // Ensure user has admin privileges
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin privileges required'
          }
        });
      }

      (req as any).user = user;
      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid admin token'
        }
      });
    }
  };

  requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Super admin privileges required'
        }
      });
    }

    next();
  };
}