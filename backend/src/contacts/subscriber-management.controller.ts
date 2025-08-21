import { Request, Response } from 'express';
import { SubscriberManagementService } from './subscriber-management.service';

export class SubscriberManagementController {
  private subscriberService: SubscriberManagementService;

  constructor() {
    this.subscriberService = new SubscriberManagementService();
  }

  /**
   * Handle one-click unsubscribe
   */
  async handleOneClickUnsubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const result = await this.subscriberService.handleOneClickUnsubscribe(token, ipAddress, userAgent);
      
      if (result.success) {
        res.send(this.generateUnsubscribeSuccessPage(result.message));
      } else {
        res.status(400).send(this.generateUnsubscribeErrorPage(result.message));
      }
    } catch (error) {
      console.error('One-click unsubscribe error:', error);
      res.status(500).send(this.generateUnsubscribeErrorPage('An error occurred while processing your request.'));
    }
  }

  /**
   * Handle manual unsubscribe
   */
  async handleManualUnsubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { email, reason, campaignId } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const result = await this.subscriberService.handleManualUnsubscribe({
        email,
        reason,
        campaignId,
        ipAddress,
        userAgent
      });
      
      res.json(result);
    } catch (error) {
      console.error('Manual unsubscribe error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process unsubscribe request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get subscriber preferences
   */
  async getSubscriberPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const tenantId = (req as any).user.tenantId;
      
      const preferences = await this.subscriberService.getSubscriberPreferences(tenantId, contactId);
      
      if (!preferences) {
        res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscriber preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update subscriber preferences
   */
  async updateSubscriberPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const tenantId = (req as any).user.tenantId;
      const updates = req.body;
      
      const updatedPreferences = await this.subscriberService.updateSubscriberPreferences(
        tenantId, 
        contactId, 
        updates
      );
      
      res.json({
        success: true,
        data: updatedPreferences,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update subscriber preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Deduplicate contacts
   */
  async deduplicateContacts(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user.tenantId;
      
      const result = await this.subscriberService.deduplicateContacts(tenantId);
      
      res.json({
        success: true,
        data: result,
        message: `Successfully processed ${result.contactsProcessed} contacts, removed ${result.duplicatesRemoved} duplicates`
      });
    } catch (error) {
      console.error('Deduplication error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deduplicate contacts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get contact history
   */
  async getContactHistory(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const tenantId = (req as any).user.tenantId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await this.subscriberService.getContactHistory(tenantId, contactId, limit, offset);
      
      res.json({
        success: true,
        data: result,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + limit < result.total
        }
      });
    } catch (error) {
      console.error('Get contact history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get contact engagement analytics
   */
  async getContactEngagementAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const tenantId = (req as any).user.tenantId;
      
      const analytics = await this.subscriberService.getContactEngagementAnalytics(tenantId, contactId);
      
      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get contact analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate unsubscribe token
   */
  async generateUnsubscribeToken(req: Request, res: Response): Promise<void> {
    try {
      const { email, campaignId } = req.body;
      
      const token = this.subscriberService.generateUnsubscribeToken(email, campaignId);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.json({
        success: true,
        data: {
          token,
          unsubscribeUrl: `${baseUrl}/api/contacts/unsubscribe/${token}`,
          listUnsubscribeHeader: `<${baseUrl}/api/contacts/unsubscribe/${token}>`
        }
      });
    } catch (error) {
      console.error('Generate token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate unsubscribe token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate HTML page for successful unsubscribe
   */
  private generateUnsubscribeSuccessPage(message: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed Successfully</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            text-align: center;
            max-width: 500px;
            width: 100%;
          }
          
          .success-icon {
            width: 80px;
            height: 80px;
            background: #28a745;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            animation: pulse 2s infinite;
          }
          
          .success-icon::after {
            content: '✓';
            color: white;
            font-size: 40px;
            font-weight: bold;
          }
          
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          
          h1 {
            color: #28a745;
            font-size: 28px;
            margin-bottom: 16px;
            font-weight: 600;
          }
          
          p {
            color: #666;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 12px;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon"></div>
          <h1>Unsubscribed Successfully</h1>
          <p>${message}</p>
          <p>You will no longer receive marketing emails from us.</p>
          <div class="footer">
            <p>If you unsubscribed by mistake, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML page for unsubscribe error
   */
  private generateUnsubscribeErrorPage(message: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribe Error</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            text-align: center;
            max-width: 500px;
            width: 100%;
          }
          
          .error-icon {
            width: 80px;
            height: 80px;
            background: #dc3545;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          
          .error-icon::after {
            content: '⚠';
            color: white;
            font-size: 40px;
          }
          
          h1 {
            color: #dc3545;
            font-size: 28px;
            margin-bottom: 16px;
            font-weight: 600;
          }
          
          p {
            color: #666;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 12px;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon"></div>
          <h1>Unsubscribe Error</h1>
          <p>${message}</p>
          <div class="footer">
            <p>If you continue to have issues, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}