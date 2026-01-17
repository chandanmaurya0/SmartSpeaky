import { encrypt, decrypt } from './src/utils/encryption.js'

// Set dummy encryption key for testing
process.env.ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const testKey = 'sk-antigravity-12345-secret-key'
console.log('Original Key:', testKey)

try {
  const encrypted = encrypt(testKey)
  console.log('Encrypted:', encrypted)

  const decrypted = decrypt(encrypted)
  console.log('Decrypted:', decrypted)

  if (testKey === decrypted) {
    console.log('✅ Success: Encryption and Decryption are working correctly!')
  } else {
    console.error('❌ Failure: Decrypted key does not match original!')
    process.exit(1)
  }
} catch (error) {
  console.error('❌ Error during encryption/decryption test:', error)
  process.exit(1)
}
