import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  generateApiKey,
  getApiKeyPrefix,
  generateEncryptionKey,
  hashValue,
} from '@/lib/crypto/secrets'

describe('Secrets Encryption Module', () => {
  beforeEach(() => {
    // Set a valid 32-byte encryption key for tests (base64 encoded)
    process.env.SECRETS_ENCRYPTION_KEY = 'J4lWzCRe3wwMqDQ6/KknDu2A1qoODgV92kcTosd/zNI='
  })

  describe('encryptSecret and decryptSecret', () => {
    it('should encrypt and decrypt a secret correctly', () => {
      const originalSecret = 'sk_test_12345678901234567890'
      
      const { encryptedValue, iv } = encryptSecret(originalSecret)
      
      expect(encryptedValue).toBeDefined()
      expect(iv).toBeDefined()
      expect(encryptedValue).not.toBe(originalSecret)
      
      const decrypted = decryptSecret(encryptedValue, iv)
      expect(decrypted).toBe(originalSecret)
    })

    it('should produce different encrypted values for same input', () => {
      const secret = 'my-api-key-123'
      
      const result1 = encryptSecret(secret)
      const result2 = encryptSecret(secret)
      
      // Different IVs should produce different encrypted values
      expect(result1.encryptedValue).not.toBe(result2.encryptedValue)
      expect(result1.iv).not.toBe(result2.iv)
      
      // But both should decrypt to the same value
      expect(decryptSecret(result1.encryptedValue, result1.iv)).toBe(secret)
      expect(decryptSecret(result2.encryptedValue, result2.iv)).toBe(secret)
    })

    it('should handle empty strings', () => {
      const { encryptedValue, iv } = encryptSecret('')
      const decrypted = decryptSecret(encryptedValue, iv)
      expect(decrypted).toBe('')
    })

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\'\\/'
      
      const { encryptedValue, iv } = encryptSecret(specialChars)
      const decrypted = decryptSecret(encryptedValue, iv)
      
      expect(decrypted).toBe(specialChars)
    })

    it('should handle unicode characters', () => {
      const unicode = '密码 пароль كلمة السر 🔐🔑'
      
      const { encryptedValue, iv } = encryptSecret(unicode)
      const decrypted = decryptSecret(encryptedValue, iv)
      
      expect(decrypted).toBe(unicode)
    })

    it('should handle long strings', () => {
      const longSecret = 'a'.repeat(10000)
      
      const { encryptedValue, iv } = encryptSecret(longSecret)
      const decrypted = decryptSecret(encryptedValue, iv)
      
      expect(decrypted).toBe(longSecret)
    })
  })

  describe('maskSecret', () => {
    it('should mask a secret with default visible chars', () => {
      const secret = 'sk_test_12345678901234567890'
      const masked = maskSecret(secret)
      
      expect(masked).toMatch(/^sk_t\*+7890$/)
      expect(masked).not.toContain('123456789')
    })

    it('should mask a secret with custom visible chars', () => {
      const secret = 'my-secret-key-12345'
      const masked = maskSecret(secret, 2)
      
      expect(masked.startsWith('my')).toBe(true)
      expect(masked.endsWith('45')).toBe(true)
    })

    it('should fully mask short secrets', () => {
      const shortSecret = 'abc'
      const masked = maskSecret(shortSecret)
      
      expect(masked).toBe('***')
    })

    it('should handle empty string', () => {
      expect(maskSecret('')).toBe('')
    })
  })

  describe('generateApiKey', () => {
    it('should generate a key with default prefix', () => {
      const key = generateApiKey()
      
      expect(key).toMatch(/^cpk_[A-Za-z0-9_-]+$/)
      expect(key.length).toBeGreaterThan(30)
    })

    it('should generate a key with custom prefix', () => {
      const key = generateApiKey('sk_live')
      
      expect(key).toMatch(/^sk_live_[A-Za-z0-9_-]+$/)
    })

    it('should generate a key with custom length', () => {
      const key = generateApiKey('test', 16)
      
      expect(key).toMatch(/^test_[A-Za-z0-9_-]+$/)
    })

    it('should generate unique keys', () => {
      const keys = Array.from({ length: 100 }, () => generateApiKey())
      const uniqueKeys = new Set(keys)
      
      expect(uniqueKeys.size).toBe(100)
    })
  })

  describe('getApiKeyPrefix', () => {
    it('should extract prefix from API key', () => {
      const key = 'sk_live_abc123def456'
      const prefix = getApiKeyPrefix(key)
      
      expect(prefix).toBe('sk_live')
    })

    it('should handle key without underscore', () => {
      const key = 'simplekey123'
      const prefix = getApiKeyPrefix(key)
      
      expect(prefix).toBe('simpleke')
    })
  })

  describe('generateEncryptionKey', () => {
    it('should generate a valid base64 key', () => {
      const key = generateEncryptionKey()
      
      expect(key).toBeDefined()
      expect(typeof key).toBe('string')
      
      // Should be valid base64
      const decoded = Buffer.from(key, 'base64')
      expect(decoded.length).toBe(32) // 256 bits
    })

    it('should generate unique keys', () => {
      const keys = Array.from({ length: 10 }, () => generateEncryptionKey())
      const uniqueKeys = new Set(keys)
      
      expect(uniqueKeys.size).toBe(10)
    })
  })

  describe('hashValue', () => {
    it('should hash a value', async () => {
      const value = 'my-secret-value'
      const hash = await hashValue(value)
      
      expect(hash).toBeDefined()
      expect(hash.length).toBe(64) // SHA-256 produces 64 hex chars
    })

    it('should produce consistent hashes', async () => {
      const value = 'consistent-value'
      
      const hash1 = await hashValue(value)
      const hash2 = await hashValue(value)
      
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different values', async () => {
      const hash1 = await hashValue('value1')
      const hash2 = await hashValue('value2')
      
      expect(hash1).not.toBe(hash2)
    })
  })
})
