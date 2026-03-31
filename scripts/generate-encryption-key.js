#!/usr/bin/env node

/**
 * Generate a secure encryption key for ENCRYPTION_KEY environment variable
 * 
 * Usage: node scripts/generate-encryption-key.js
 */

const crypto = require('crypto')

const key = crypto.randomBytes(32).toString('hex')

console.log('\n🔐 Generated Encryption Key:')
console.log('='.repeat(60))
console.log(key)
console.log('='.repeat(60))
console.log('\n📝 Add this to your .env file:')
console.log(`ENCRYPTION_KEY="${key}"`)
console.log('\n⚠️  IMPORTANT:')
console.log('   - Keep this key secure and never commit it to git')
console.log('   - Use different keys for development and production')
console.log('   - If you lose this key, encrypted passwords cannot be recovered')
console.log('')

