import * as crypto from 'crypto';

// Encryption key should be 32 bytes for AES-256
// If PMS_ENCRYPTION_KEY is not set, generate a random 32-byte key
const getEncryptionKey = (): Buffer => {
  if (process.env.PMS_ENCRYPTION_KEY) {
    const key = process.env.PMS_ENCRYPTION_KEY;
    // If key is hex encoded, convert from hex
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      return Buffer.from(key, 'hex');
    }
    // If key is base64 encoded
    if (/^[A-Za-z0-9+/]+=*$/.test(key)) {
      const buffer = Buffer.from(key, 'base64');
      if (buffer.length === 32) return buffer;
    }
    // Otherwise use as UTF-8, pad or truncate to 32 bytes
    const buffer = Buffer.alloc(32);
    Buffer.from(key, 'utf8').copy(buffer);
    return buffer;
  }
  
  // Generate random key if none provided
  console.warn('⚠️  PMS_ENCRYPTION_KEY not set, using random key. Set this in production!');
  return crypto.randomBytes(32);
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

interface EncryptedData {
  iv: string;
  authTag: string;
  encrypted: string;
}

/**
 * Encrypt PMS credentials using AES-256-GCM
 * @param credentials - Object containing PMS credentials
 * @returns Encrypted string
 */
export function encryptPMSCredentials(credentials: any): string {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      iv
    );
    
    // Encrypt data
    const credentialsString = JSON.stringify(credentials);
    let encrypted = cipher.update(credentialsString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Return encrypted data as JSON string
    const encryptedData: EncryptedData = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted: encrypted
    };
    
    return JSON.stringify(encryptedData);
  } catch (error) {
    console.error('Error encrypting PMS credentials:', error);
    throw new Error('Failed to encrypt PMS credentials');
  }
}

/**
 * Decrypt PMS credentials using AES-256-GCM
 * @param encryptedData - Encrypted string
 * @returns Decrypted credentials object
 */
export function decryptPMSCredentials(encryptedData: string): any {
  try {
    // Parse encrypted data
    const data: EncryptedData = JSON.parse(encryptedData);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(data.iv, 'hex')
    );
    
    // Set authentication tag
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    // Decrypt data
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse and return
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error decrypting PMS credentials:', error);
    throw new Error('Failed to decrypt PMS credentials');
  }
}

/**
 * Encrypt bank account information using AES-256-GCM
 * @param bankInfo - Object containing bank account information
 * @returns Encrypted string
 */
export function encryptBankInfo(bankInfo: any): string {
  return encryptPMSCredentials(bankInfo); // Same encryption method
}

/**
 * Decrypt bank account information using AES-256-GCM
 * @param encryptedData - Encrypted string
 * @returns Decrypted bank info object
 */
export function decryptBankInfo(encryptedData: string): any {
  return decryptPMSCredentials(encryptedData); // Same decryption method
}

/**
 * Generate a secure encryption key (for initial setup)
 * This should be called once and stored in .env as PMS_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex').substring(0, 32);
}

/**
 * Validate that encryption key is properly configured
 */
export function validateEncryptionKey(): boolean {
  if (!process.env.PMS_ENCRYPTION_KEY || process.env.PMS_ENCRYPTION_KEY.length !== 32) {
    console.warn('⚠️  PMS_ENCRYPTION_KEY not properly configured in .env');
    console.warn('   Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\').substring(0, 32))"');
    return false;
  }
  return true;
}

// Validate on module load (in development/production)
if (process.env.NODE_ENV !== 'test') {
  validateEncryptionKey();
}
