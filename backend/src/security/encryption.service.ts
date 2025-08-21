import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltRounds = 12;

  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Derive key from environment variable
    this.encryptionKey = crypto.scryptSync(key, 'salt', this.keyLength);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('bulk-email-platform'));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const { encrypted, iv, tag } = encryptedData;
    
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('bulk-email-platform'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash passwords using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key with secure random bytes
   */
  generateApiKey(): string {
    const prefix = 'bep_'; // bulk email platform
    const randomPart = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomPart}`;
  }

  /**
   * Hash API key for storage
   */
  async hashApiKey(apiKey: string): Promise<string> {
    return this.hashPassword(apiKey);
  }

  /**
   * Verify API key against hash
   */
  async verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
    return this.verifyPassword(apiKey, hash);
  }

  /**
   * Encrypt PII data for database storage
   */
  encryptPII(data: string): string {
    if (!data) return data;
    
    const encrypted = this.encrypt(data);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt PII data from database
   */
  decryptPII(encryptedData: string): string {
    if (!encryptedData) return encryptedData;
    
    try {
      const parsed = JSON.parse(encryptedData);
      return this.decrypt(parsed);
    } catch (error) {
      // If parsing fails, assume data is not encrypted (for backward compatibility)
      return encryptedData;
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  generateHmacSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'apiKey', 'secret', 'key',
      'email', 'phone', 'firstName', 'lastName',
      'address', 'creditCard', 'ssn'
    ];

    const masked = { ...data };
    
    for (const field of sensitiveFields) {
      if (masked[field]) {
        if (typeof masked[field] === 'string') {
          masked[field] = this.maskString(masked[field]);
        }
      }
    }

    return masked;
  }

  /**
   * Mask string data (show first 2 and last 2 characters)
   */
  private maskString(str: string): string {
    if (str.length <= 4) {
      return '*'.repeat(str.length);
    }
    
    const start = str.substring(0, 2);
    const end = str.substring(str.length - 2);
    const middle = '*'.repeat(str.length - 4);
    
    return `${start}${middle}${end}`;
  }
}