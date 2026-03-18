/**
 * Secrets Encryption Utility
 *
 * AES-256-GCM encryption for storing sensitive data (API keys, tokens, etc.)
 * in the database.
 *
 * IMPORTANT: In production, SECRETS_ENCRYPTION_KEY must be set.
 * The fallback key is only allowed in development.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.SECRETS_ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SECRETS_ENCRYPTION_KEY is required in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
      );
    }
    // Dev-only fallback
    const fallback = process.env.NEXTAUTH_SECRET || "insecure-default-key";
    return Buffer.from(fallback.padEnd(KEY_LENGTH, "0").slice(0, KEY_LENGTH));
  }

  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded). Got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

export function encryptSecret(plaintext: string): {
  encryptedValue: string;
  iv: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

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

export function decryptSecret(encryptedValue: string, iv: string): string {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, "base64");

  const encryptedBuffer = Buffer.from(encryptedValue, "base64");
  const authTag = encryptedBuffer.slice(-AUTH_TAG_LENGTH);
  const encrypted = encryptedBuffer.slice(0, -AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

export function maskSecret(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return "*".repeat(value.length);
  }
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const masked = "*".repeat(Math.min(value.length - visibleChars * 2, 20));
  return `${start}${masked}${end}`;
}
