import { settingsService } from './settingsService.js'
import { redisService } from '../../db/redis.js'
import { AdvancedSettingsRepository } from '../../db/repo.js'
import { v4 as uuidv4 } from 'uuid'

async function runTest() {
  const userId = `test-user-${uuidv4()}`
  console.log(`Starting test for user: ${userId}`)

  try {
    // 1. Update settings (this should populate cache)
    const updateReq = {
      llm: {
        asrModel: 'test-model',
        llmApiKey: 'test-api-key-decrypted', // We expect this to be stored plain text in Redis
      },
    }

    console.log('1. Updating settings...')
    await settingsService.updateAdvancedSettings(userId, updateReq)

    // 2. Verify Redis Cache
    const cacheKey = `user:${userId}:advanced_settings`
    const cachedValue = await redisService.getJson<any>(cacheKey)

    console.log('2. Checking Redis Cache...')
    if (cachedValue) {
      console.log('✅ Cache Hit')
      if (cachedValue.llm.llm_api_key === 'test-api-key-decrypted') {
        console.log('✅ API Key is DECRYPTED in Redis')
      } else {
        console.error(
          '❌ API Key mismatch in Redis:',
          cachedValue.llm.llm_api_key,
        )
      }
    } else {
      console.error('❌ Cache Miss (Expected Hit)')
    }

    // 3. Clear Cache and Fetch (Should re-populate)
    await redisService.deleteKey(cacheKey)
    console.log('3. Cleared Cache. Fetching via Service...')

    // We expect this to fetch from DB (which decrypts) and store in Redis
    const fetchedSettings = await settingsService.getAdvancedSettings(userId)

    if (fetchedSettings.llm.llm_api_key === 'test-api-key-decrypted') {
      console.log('✅ Service returned decrypted key')
    } else {
      console.error('❌ Service returned encrypted/wrong key')
    }

    // Check Redis again
    const cachedAgain = await redisService.getJson<any>(cacheKey)
    if (cachedAgain) {
      console.log('✅ Settings re-cached successfully')
    } else {
      console.error('❌ Settings NOT re-cached')
    }
  } catch (error) {
    console.error('Test Failed:', error)
  } finally {
    // Cleanup
    await redisService.deleteKey(`user:${userId}:advanced_settings`)
    // We should ideally clean up DB too, but hardDeleteByUserId is available
    await AdvancedSettingsRepository.hardDeleteByUserId(userId)

    await redisService.quit()
    // We need to close DB pool too but that might be global.
    // Just exit process
    process.exit(0)
  }
}

runTest()
