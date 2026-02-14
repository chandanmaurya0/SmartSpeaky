import { Redis } from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  throw new Error('REDIS_URL or REDIS_HOST must be set in the environment')
}

/**
 * Service to handle Redis operations.
 * Connects using REDIS_URL or host/port configuration.
 */
const redisUrl =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`

class RedisService {
  private client: Redis

  constructor() {
    this.client = new Redis(redisUrl, {
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    })

    this.client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err)
    })

    this.client.on('connect', () => {
      console.log('Connected to Redis....')
    })
  }

  /**
   * Stores a JSON-serializable value in Redis.
   * @param key Redis key
   * @param value Value to store (will be stringified)
   * @param ttlSeconds Optional time-to-live in seconds
   */
  async setJson(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value)
    if (ttlSeconds) {
      await this.client.set(key, stringValue, 'EX', ttlSeconds)
    } else {
      await this.client.set(key, stringValue)
    }
  }

  /**
   * Retrieves and parses a JSON value from Redis.
   * @param key Redis key
   * @returns Parsed value or null if not found
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch (e) {
      console.error(`Error parsing JSON for key ${key}:`, e)
      return null
    }
  }

  /**
   * Deletes a key from Redis.
   */
  async deleteKey(key: string): Promise<void> {
    await this.client.del(key)
  }

  /**
   * Gracefully shuts down the Redis connection.
   */
  async quit(): Promise<void> {
    await this.client.quit()
  }
}

export const redisService = new RedisService()
export default redisService
