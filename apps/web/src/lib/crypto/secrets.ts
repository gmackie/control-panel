/**
 * Secrets Encryption Utility
 * 
 * Provides AES-256-GCM encryption for storing sensitive data like API keys,
 * tokens, and other secrets in the database.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

// Encryption algorithm
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment
 * Falls back to a derived key if not set (not recommended for production)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SECRETS_ENCRYPTION_KEY;
  
  if (!key) {
    console.warn(
      "WARNING: SECRETS_ENCRYPTION_KEY not set. Using derived key. " +
      "This is NOT secure for production use!"
    );
    // Derive a key from NEXTAUTH_SECRET as fallback
    const fallback = process.env.NEXTAUTH_SECRET || "insecure-default-key";
    return Buffer.from(fallback.padEnd(KEY_LENGTH, "0").slice(0, KEY_LENGTH));
  }
  
  // Key should be base64 encoded 32 bytes
  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded). ` +
      `Got ${keyBuffer.length} bytes.`
    );
  }
  
  return keyBuffer;
}

/**
 * Generate a new encryption key
 * Use this to generate a key for SECRETS_ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("base64");
}

/**
 * Encrypt a secret value
 * 
 * @param plaintext The secret value to encrypt
 * @returns Object with encrypted value and IV (both base64 encoded)
 */
export function encryptSecret(plaintext: string): {
  encryptedValue: string;
  iv: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  // Get the auth tag and append it to the encrypted data
  const authTag = cipher.getAuthTag();
  const encryptedWithTag = Buffer.concat([
    Buffer.from(encrypted, "base64"),
    authTag,
  ]).toString("base64");
  
  return {
    encryptedValue: encryptedWithTag,
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt a secret value
 * 
 * @param encryptedValue The encrypted value (base64 encoded)
 * @param iv The initialization vector (base64 encoded)
 * @returns The decrypted plaintext
 */
export function decryptSecret(encryptedValue: string, iv: string): string {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, "base64");
  
  // Split the encrypted data and auth tag
  const encryptedBuffer = Buffer.from(encryptedValue, "base64");
  const authTag = encryptedBuffer.slice(-AUTH_TAG_LENGTH);
  const encrypted = encryptedBuffer.slice(0, -AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}

/**
 * Mask a secret value for display
 * Shows only the first and last few characters
 * 
 * @param value The secret value to mask
 * @param visibleChars Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSecret(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return "*".repeat(value.length);
  }
  
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const masked = "*".repeat(Math.min(value.length - visibleChars * 2, 20));
  
  return `${start}${masked}${end}`;
}

/**
 * Hash a value for comparison (one-way)
 * Useful for API key prefixes
 */
export async function hashValue(value: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a secure random API key
 * 
 * @param prefix Optional prefix for the key
 * @param length Length of the random part
 * @returns Generated API key
 */
export function generateApiKey(prefix: string = "cpk", length: number = 32): string {
  const randomPart = randomBytes(length).toString("base64url");
  return `${prefix}_${randomPart}`;
}

/**
 * Extract the prefix from an API key
 */
export function getApiKeyPrefix(apiKey: string): string {
  const parts = apiKey.split("_");
  if (parts.length > 1) {
    return parts[0] + "_" + parts[1].slice(0, 4);
  }
  return apiKey.slice(0, 8);
}

/**
 * Validate that a string looks like an encrypted secret
 */
export function isValidEncryptedSecret(
  encryptedValue: string,
  iv: string
): boolean {
  try {
    // Check that both are valid base64
    const encBuffer = Buffer.from(encryptedValue, "base64");
    const ivBuffer = Buffer.from(iv, "base64");
    
    // IV should be exactly IV_LENGTH bytes
    if (ivBuffer.length !== IV_LENGTH) {
      return false;
    }
    
    // Encrypted value should have at least the auth tag
    if (encBuffer.length < AUTH_TAG_LENGTH) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Rotate encryption - decrypt with old key and re-encrypt with new key
 * Used when rotating the encryption key
 */
export function rotateEncryption(
  encryptedValue: string,
  iv: string,
  oldKey: string,
  newKey: string
): { encryptedValue: string; iv: string } {
  // Temporarily set the old key
  const originalKey = process.env.SECRETS_ENCRYPTION_KEY;
  process.env.SECRETS_ENCRYPTION_KEY = oldKey;
  
  try {
    // Decrypt with old key
    const plaintext = decryptSecret(encryptedValue, iv);
    
    // Set new key
    process.env.SECRETS_ENCRYPTION_KEY = newKey;
    
    // Re-encrypt with new key
    return encryptSecret(plaintext);
  } finally {
    // Restore original key
    process.env.SECRETS_ENCRYPTION_KEY = originalKey;
  }
}

// Type for encrypted secret data
export interface EncryptedSecret {
  encryptedValue: string;
  iv: string;
}

// Type for secret with metadata
export interface SecretWithMetadata extends EncryptedSecret {
  name: string;
  environment: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastRotatedAt?: Date;
  expiresAt?: Date;
}
