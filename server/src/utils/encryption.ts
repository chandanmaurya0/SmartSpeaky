import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

/**
 * Gets the encryption key from environment variable.
 * Expects a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    )
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a string in the format: iv:tag:encryptedData
 */
export function encrypt(text: string): string {
  if (!text) return ''

  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

/**
 * Decrypts a string formatted as iv:tag:encryptedData.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''

  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    // If it's not in the expected format, return as is (might be legacy plain text)
    // Or throw error depending on strictness. For now, let's be safe.
    return encryptedText
  }

  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const key = getEncryptionKey()

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(dataHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
