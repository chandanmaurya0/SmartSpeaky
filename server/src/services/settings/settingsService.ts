import { AdvancedSettingsRepository } from '../../db/repo.js'
import { redisService } from '../../db/redis.js'
import { AdvancedSettings } from '../../db/models.js'
import { UpdateAdvancedSettingsRequest } from '../../generated/ito_pb.js'

const SETTINGS_CACHE_TTL = 24 * 60 * 60 // 24 hours in seconds

export class SettingsService {
  private getCacheKey(userId: string): string {
    return `user:${userId}:advanced_settings`
  }

  /**
   * Retrieves advanced settings for a user, using Redis cache if available.
   * If not in cache, fetches from DB and caches the result.
   * stored keys in Redis are DECROPTED.
   */
  async getAdvancedSettings(userId: string): Promise<AdvancedSettings> {
    const cacheKey = this.getCacheKey(userId)

    // 1. Try Cache
    try {
      const cached = await redisService.getJson<AdvancedSettings>(cacheKey)
      if (cached) {
        // We need to ensure dates are converted back to Date objects from JSON strings if necessary
        // But since we are likely just passing this to protobuf or using properties,
        // let's verify if we need strict Date objects.
        // The domain model has Date fields. JSON.parse will return strings.
        // We might need a hydrator if the consumers expect real Date objects.
        return this.hydrateSettings(cached)
      }
    } catch (error) {
      console.error('Redis get error:', error)
      // Fallback to DB
    }

    // 2. Fetch from DB
    const settings = await AdvancedSettingsRepository.findByUserId(userId)

    // 3. Fallback to default if not found (matching current behavior in itoService)
    if (!settings) {
      // We don't have a record, so we return a default structure conforming to AdvancedSettings interface
      // Note: We don't cache the fallback default unless we actually create it in DB?
      // The current itoService just returns a default object without persisting it.
      // We should probably NOT cache the default to avoid polluting cache with non-existent data
      // or we COULD cache it if we want to avoid DB hits for new users too.
      // For now, let's mimic existing behavior: return default object, do not cache.
      return {
        id: '',
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date(),
        llm: {
          asr_model: null,
          asr_provider: null,
          asr_prompt: null,
          llm_provider: null,
          llm_model: null,
          llm_temperature: null,
          transcription_prompt: null,
          editing_prompt: null,
          no_speech_threshold: null,
          low_quality_threshold: null,
          asr_api_key: null,
          llm_api_key: null,
        },
      }
    }

    // 4. Update Cache
    // Hydrate BEFORE caching to ensure clean numbers in Redis too
    const hydratedSettings = this.hydrateSettings(settings)

    try {
      await redisService.setJson(cacheKey, hydratedSettings, SETTINGS_CACHE_TTL)
    } catch (error) {
      console.error('Redis set error:', error)
    }

    return hydratedSettings
  }

  /**
   * Updates advanced settings in DB and updates the cache.
   */
  async updateAdvancedSettings(
    userId: string,
    request: UpdateAdvancedSettingsRequest,
  ): Promise<AdvancedSettings> {
    // 1. Update DB
    const updatedSettings = await AdvancedSettingsRepository.upsert(
      userId,
      request,
    )

    const hydratedSettings = this.hydrateSettings(updatedSettings)

    // 2. Update Cache (Write-Through)
    const cacheKey = this.getCacheKey(userId)
    try {
      await redisService.setJson(cacheKey, hydratedSettings, SETTINGS_CACHE_TTL)
    } catch (error) {
      console.error('Redis set error:', error)
    }

    return hydratedSettings
  }

  private hydrateSettings(settings: any): AdvancedSettings {
    const toNumberOrNull = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null
      const num = Number(val)
      return isNaN(num) ? null : num
    }

    return {
      ...settings,
      created_at: new Date(settings.created_at),
      updated_at: new Date(settings.updated_at),
      llm: {
        ...settings.llm,
        llm_temperature: toNumberOrNull(settings.llm.llm_temperature),
        no_speech_threshold: toNumberOrNull(settings.llm.no_speech_threshold),
        low_quality_threshold: toNumberOrNull(
          settings.llm.low_quality_threshold,
        ),
      },
    }
  }
}

export const settingsService = new SettingsService()
