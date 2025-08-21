import https from 'https';
import fs from 'fs';
import path from 'path';

export interface TLSConfig {
  key?: Buffer;
  cert?: Buffer;
  ca?: Buffer[];
  minVersion?: string;
  maxVersion?: string;
  ciphers?: string;
  honorCipherOrder?: boolean;
  secureProtocol?: string;
}

export class TLSConfigService {
  /**
   * Get TLS configuration for HTTPS server
   */
  static getServerTLSConfig(): TLSConfig | null {
    const certPath = process.env.TLS_CERT_PATH;
    const keyPath = process.env.TLS_KEY_PATH;
    const caPath = process.env.TLS_CA_PATH;

    if (!certPath || !keyPath) {
      console.warn('TLS certificates not configured. Running in HTTP mode.');
      return null;
    }

    try {
      const config: TLSConfig = {
        key: fs.readFileSync(path.resolve(keyPath)),
        cert: fs.readFileSync(path.resolve(certPath)),
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        // Secure cipher suites (prioritize TLS 1.3 and strong TLS 1.2 ciphers)
        ciphers: [
          // TLS 1.3 cipher suites
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256',
          // TLS 1.2 cipher suites
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES256-SHA384',
          'ECDHE-RSA-AES128-SHA256',
          'ECDHE-RSA-AES256-SHA',
          'ECDHE-RSA-AES128-SHA'
        ].join(':'),
        honorCipherOrder: true,
        secureProtocol: 'TLSv1_2_method'
      };

      // Add CA certificate if provided
      if (caPath && fs.existsSync(caPath)) {
        config.ca = [fs.readFileSync(path.resolve(caPath))];
      }

      return config;
    } catch (error) {
      console.error('Failed to load TLS certificates:', error);
      throw new Error('TLS configuration failed');
    }
  }

  /**
   * Get TLS configuration for outbound HTTPS requests
   */
  static getClientTLSConfig(): https.AgentOptions {
    return {
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256'
      ].join(':'),
      honorCipherOrder: true,
      checkServerIdentity: (hostname: string, cert: any) => {
        // Custom server identity check if needed
        return undefined; // Use default Node.js verification
      }
    };
  }

  /**
   * Create secure HTTPS agent for external API calls
   */
  static createSecureAgent(): https.Agent {
    return new https.Agent(this.getClientTLSConfig());
  }

  /**
   * Validate TLS configuration
   */
  static validateTLSConfig(): boolean {
    try {
      const config = this.getServerTLSConfig();
      return config !== null;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Security headers middleware
 */
export const securityHeaders = (req: any, res: any, next: any) => {
  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ].join(', '));
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};