import { redisService } from './db/redis.js'

async function testRedis() {
  console.log('Starting Redis test...')

  const testKey = 'test:user:settings'
  const testValue = {
    advancedSetting: {
      enableLlmAdjustment: true,
      provider: 'groq',
      model: 'llama3-70b-8192',
    },
  }

  try {
    console.log('Setting JSON value...')
    await redisService.setJson(testKey, testValue, 60)
    console.log('Value set successfully.')

    console.log('Getting JSON value...')
    const retrievedValue = await redisService.getJson(testKey)
    console.log('Retrieved value:', JSON.stringify(retrievedValue, null, 2))

    if (JSON.stringify(testValue) === JSON.stringify(retrievedValue)) {
      console.log('SUCCESS: Values match!')
    } else {
      console.error('FAILURE: Values do not match!')
    }

    console.log('Deleting key...')
    await redisService.deleteKey(testKey)
    console.log('Key deleted.')

    const deletedValue = await redisService.getJson(testKey)
    if (deletedValue === null) {
      console.log('SUCCESS: Key was deleted.')
    } else {
      console.error('FAILURE: Key still exists!')
    }
  } catch (error) {
    console.error('Redis Test Failed:', error)
  } finally {
    await redisService.quit()
    process.exit(0)
  }
}

testRedis()
