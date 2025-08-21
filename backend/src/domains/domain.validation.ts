import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation middleware for domain creation
 */
export const validateCreateDomain = [
  body('domain')
    .notEmpty()
    .withMessage('Domain is required')
    .isLength({ min: 3, max: 255 })
    .withMessage('Domain must be between 3 and 255 characters')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)
    .withMessage('Invalid domain format')
    .custom((value) => {
      // Additional domain validation
      if (value.includes('..')) {
        throw new Error('Domain cannot contain consecutive dots');
      }
      if (value.startsWith('-') || value.endsWith('-')) {
        throw new Error('Domain cannot start or end with hyphen');
      }
      return true;
    }),
  handleValidationErrors
];

/**
 * Validation middleware for domain ID parameter
 */
export const validateDomainId = [
  param('id')
    .isUUID()
    .withMessage('Invalid domain ID format'),
  handleValidationErrors
];

/**
 * Validation middleware for alert ID parameter
 */
export const validateAlertId = [
  param('alertId')
    .isUUID()
    .withMessage('Invalid alert ID format'),
  handleValidationErrors
];

/**
 * Validation middleware for domain alerts query parameters
 */
export const validateDomainAlertsQuery = [
  query('includeResolved')
    .optional()
    .isBoolean()
    .withMessage('includeResolved must be a boolean'),
  handleValidationErrors
];

/**
 * Validation middleware for monitoring configuration
 */
export const validateMonitoringConfig = [
  body('checkInterval')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Check interval must be between 5 and 1440 minutes'),
  body('alertThresholds.reputationScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Reputation score threshold must be between 0 and 100'),
  body('alertThresholds.deliveryRate')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Delivery rate threshold must be between 0 and 100'),
  body('alertThresholds.bounceRate')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Bounce rate threshold must be between 0 and 100'),
  body('enabledChecks.dnsRecords')
    .optional()
    .isBoolean()
    .withMessage('DNS records check must be a boolean'),
  body('enabledChecks.reputation')
    .optional()
    .isBoolean()
    .withMessage('Reputation check must be a boolean'),
  body('enabledChecks.deliverability')
    .optional()
    .isBoolean()
    .withMessage('Deliverability check must be a boolean'),
  handleValidationErrors
];

/**
 * Handle validation errors middleware
 */
function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : error.type,
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
    return;
  }
  
  next();
}

/**
 * Custom domain format validator
 */
export function isValidDomain(domain: string): boolean {
  // Basic domain format validation
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  
  if (!domainRegex.test(domain)) {
    return false;
  }
  
  // Additional checks
  if (domain.includes('..')) {
    return false;
  }
  
  if (domain.startsWith('-') || domain.endsWith('-')) {
    return false;
  }
  
  // Check for valid TLD length
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || tld.length > 6) {
    return false;
  }
  
  return true;
}

/**
 * Validate DNS record format
 */
export function isValidDNSRecord(record: any): boolean {
  if (!record || typeof record !== 'object') {
    return false;
  }
  
  const { type, name, value } = record;
  
  if (!type || !name || !value) {
    return false;
  }
  
  // Validate record type
  const validTypes = ['TXT', 'CNAME', 'MX', 'A'];
  if (!validTypes.includes(type)) {
    return false;
  }
  
  // Basic name validation
  if (typeof name !== 'string' || name.length === 0) {
    return false;
  }
  
  // Basic value validation
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  
  return true;
}

/**
 * Sanitize domain input
 */
export function sanitizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^www\./, '') // Remove www prefix
    .replace(/\/.*$/, ''); // Remove path
}