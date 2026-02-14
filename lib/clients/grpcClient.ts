import {
  ItoService,
  TimingService,
  AudioChunk,
  Note as NotePb,
  Interaction as InteractionPb,
  DictionaryItem as DictionaryItemPb,
  AdvancedSettings as AdvancedSettingsPb,
  TimingReport,
  TimingEvent,
  CreateNoteRequestSchema,
  UpdateNoteRequestSchema,
  DeleteNoteRequestSchema,
  ListNotesRequestSchema,
  CreateInteractionRequestSchema,
  UpdateInteractionRequestSchema,
  DeleteInteractionRequestSchema,
  ListInteractionsRequestSchema,
  CreateDictionaryItemRequestSchema,
  DeleteDictionaryItemRequestSchema,
  UpdateDictionaryItemRequestSchema,
  ListDictionaryItemsRequestSchema,
  DeleteUserDataRequestSchema,
  GetAdvancedSettingsRequestSchema,
  UpdateAdvancedSettingsRequestSchema,
  SubmitTimingReportsRequestSchema,
  TimingReportSchema,
  TimingEventSchema,
  ItoMode,
  TranscribeStreamRequest,
} from '@/app/generated/ito_pb'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'
import { ConnectError, Code } from '@connectrpc/connect'
import { BrowserWindow } from 'electron'
import { create } from '@bufbuild/protobuf'
// import { Note, Interaction, DictionaryItem } from '../main/sqlite/models'
// import { DictionaryTable } from '../main/sqlite/repo'
import {
  AdvancedSettings,
  getAdvancedSettings,
  getCurrentUserId,
  store,
} from '../main/store'
import { getSelectedTextString } from '../media/selected-text-reader'
import { ensureValidTokens } from '../auth/events'
import { Auth0Config } from '../auth/config'
import { getActiveWindow } from '../media/active-application'
import { STORE_KEYS } from '../constants/store-keys.js'

class GrpcClient {
  private client: ReturnType<typeof createClient<typeof ItoService>>
  private timingClient: ReturnType<typeof createClient<typeof TimingService>>
  private authToken: string | null = null
  private mainWindow: BrowserWindow | null = null
  private isRefreshingTokens: boolean = false

  constructor() {
    const transport = createConnectTransport({
      baseUrl: import.meta.env.VITE_GRPC_BASE_URL,
      httpVersion: '1.1',
    })
    console.log(
      'Creating gRPC client with base URL:',
      import.meta.env.VITE_GRPC_BASE_URL,
    )
    this.client = createClient(ItoService, transport)
    this.timingClient = createClient(TimingService, transport)
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  // Helper method to safely send messages to the main window
  private safeSendToMainWindow(channel: string, ...args: any[]) {
    if (
      this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      !this.mainWindow.webContents.isDestroyed()
    ) {
      try {
        this.mainWindow.webContents.send(channel, ...args)
      } catch (error) {
        console.warn(
          `Failed to send message to main window on channel ${channel}:`,
          error,
        )
        // Clear the reference to the destroyed window
        this.mainWindow = null
      }
    }
  }

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  private getHeaders() {
    if (!this.authToken) {
      // Though we have guards elsewhere, this is a final check.
      // Throwing here helps us pinpoint auth issues during development.
      return new Headers()
    }
    return new Headers({ Authorization: `Bearer ${this.authToken}` })
  }

  private async getHeadersWithMetadata(mode: ItoMode) {
    const headers = this.getHeaders()

    try {
      // Fetch vocabulary from server (was local database)
      // Since this is called frequently for audio streaming, we should probably optimize this
      // by caching it in store or store.get('vocabulary') if available.
      // For now, let's skip adding vocabulary from DB to headers to avoid a blocking API call
      // on every stream chunk, or we can fetch it once per session.

      const dictionaryItems: DictionaryItemPb[] = [] // await this.listDictionaryItemsSince()

      // Convert to vocabulary format for transcription
      const vocabularyWords = dictionaryItems
        // .filter(item => item.deletedAt === null) // Protobuf doesn't have deleted_at usually for list ops unless soft deleted
        .map(item => item.word)

      // Add vocabulary to headers if available
      if (vocabularyWords.length > 0) {
        headers.set('vocabulary', vocabularyWords.join(','))
      }

      // Fetch window context
      const windowContext = await getActiveWindow()
      if (windowContext) {
        headers.set('window-title', windowContext.title)
        headers.set('app-name', windowContext.appName)
      }

      function flattenHeaderValue(value: string) {
        const flattened = value
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()

        // Check if the string contains non-ASCII characters
        // eslint-disable-next-line no-control-regex
        const hasUnicode = /[^\x00-\x7F]/.test(flattened)

        if (hasUnicode) {
          // Base64 encode to safely transmit Unicode characters via gRPC headers
          return `base64:${Buffer.from(flattened, 'utf8').toString('base64')}`
        }

        return flattened
      }

      // Add ASR model from advanced settings
      const advancedSettings = getAdvancedSettings()
      headers.set('asr-model', advancedSettings.llm.asrModel ?? '')
      headers.set('asr-provider', advancedSettings.llm.asrProvider ?? '')
      headers.set(
        'asr-prompt',
        flattenHeaderValue(advancedSettings.llm.asrPrompt ?? ''),
      )
      headers.set('llm-provider', advancedSettings.llm.llmProvider ?? '')
      headers.set('llm-model', advancedSettings.llm.llmModel ?? '')
      headers.set(
        'llm-temperature',
        advancedSettings.llm.llmTemperature?.toString() ?? '',
      )
      headers.set(
        'transcription-prompt',
        flattenHeaderValue(advancedSettings.llm.transcriptionPrompt ?? ''),
      )
      // Note: Editing prompt is currently disabled until a better versioning solution is implemented
      // https://github.com/heyito/ito/issues/174
      // headers.set(
      //   'editing-prompt',
      //   flattenHeaderValue(advancedSettings.llm.editingPrompt),
      // )
      headers.set(
        'no-speech-threshold',
        advancedSettings.llm.noSpeechThreshold?.toString() ?? '',
      )
      headers.set('asr-api-key', advancedSettings.llm.asrApiKey ?? '')
      headers.set('llm-api-key', advancedSettings.llm.llmApiKey ?? '')

      headers.set('mode', mode.toString())

      try {
        // We currently only support context gathering on mac
        if (mode === ItoMode.EDIT) {
          const contextText = await getSelectedTextString(10000)
          if (contextText && contextText.trim().length > 0) {
            headers.set('context-text', flattenHeaderValue(contextText))
            console.log(
              '[gRPC Client] Adding context text to headers:',
              contextText.length,
              'characters',
              contextText,
            )
          }
        }
      } catch (error) {
        console.error('[gRPC Client] Error getting context text:', error)
      }
    } catch (error) {
      console.error(
        'Failed to fetch vocabulary/settings for transcription:',
        error,
      )
    }

    return headers
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const shouldRetry = await this.handleAuthError(error)

      if (shouldRetry) {
        console.log('Retrying operation after token refresh')
        return await operation()
      }

      throw error
    }
  }

  private async handleAuthError(error: any): Promise<boolean> {
    // Check if this is an authentication error
    if (error instanceof ConnectError && error.code === Code.Unauthenticated) {
      console.log(
        'Authentication error detected, attempting token refresh before logout',
      )

      // Prevent multiple simultaneous refresh attempts
      if (this.isRefreshingTokens) {
        console.log('Token refresh already in progress, skipping')
        return false
      }

      try {
        this.isRefreshingTokens = true

        // Attempt to refresh tokens
        const refreshResult = await ensureValidTokens(Auth0Config)

        if (
          refreshResult.success &&
          'tokens' in refreshResult &&
          refreshResult.tokens?.access_token
        ) {
          console.log('Token refresh successful, updating auth token')
          this.authToken = refreshResult.tokens.access_token

          // Return true to indicate the caller should retry
          return true
        } else {
          console.log('Token refresh failed, proceeding with logout')
        }
      } catch (refreshError) {
        console.error('Error during token refresh:', refreshError)
      } finally {
        this.isRefreshingTokens = false
      }

      // If we get here, token refresh failed - proceed with logout
      console.log('Signing out user due to authentication failure')

      // Notify the main window to sign out the user
      this.safeSendToMainWindow('auth-token-expired')

      // Clear the auth token
      this.authToken = null
    }

    // Return false to indicate no retry should be attempted
    return false
  }

  async transcribeStream(stream: AsyncIterable<AudioChunk>, mode: ItoMode) {
    return this.withRetry(async () => {
      const response = await this.client.transcribeStream(stream, {
        headers: await this.getHeadersWithMetadata(mode),
      })
      return response
    })
  }

  async transcribeStreamV2(
    stream: AsyncIterable<TranscribeStreamRequest>,
    signal?: AbortSignal,
  ) {
    return this.withRetry(async () => {
      const response = await this.client.transcribeStreamV2(stream, {
        headers: await this.getHeadersWithMetadata(0 as unknown as ItoMode),
        signal,
      })
      return response
    })
  }

  // =================================================================
  // Notes, Interactions, Dictionary (Unary Calls)
  // =================================================================

  async createNote(note: Partial<NotePb>) {
    return this.withRetry(async () => {
      const request = create(CreateNoteRequestSchema, {
        id: note.id,
        interactionId: note.interactionId ?? '',
        content: note.content,
      })
      return await this.client.createNote(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async updateNote(note: Partial<NotePb>) {
    return this.withRetry(async () => {
      const request = create(UpdateNoteRequestSchema, {
        id: note.id,
        content: note.content,
      })
      return await this.client.updateNote(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async deleteNote(note: Partial<NotePb>) {
    return this.withRetry(async () => {
      const request = create(DeleteNoteRequestSchema, {
        id: note.id,
      })
      return await this.client.deleteNote(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async listNotesSince(since?: string): Promise<NotePb[]> {
    return this.withRetry(async () => {
      const request = create(ListNotesRequestSchema, {
        sinceTimestamp: since ?? '',
      })
      const response = await this.client.listNotes(request, {
        headers: this.getHeaders(),
      })
      return response.notes
    })
  }

  async createInteraction(interaction: any) {
    // Interaction type structure changed, using any or partial PB
    // The caller passes a local object structure, we map it to PB request
    // interaction.raw_audio is likely Buffer or Uint8Array
    return this.withRetry(async () => {
      // Convert Buffer to Uint8Array for protobuf
      let uint8AudioData: Uint8Array
      if (interaction.raw_audio) {
        uint8AudioData = new Uint8Array(interaction.raw_audio)
      } else {
        uint8AudioData = new Uint8Array()
      }

      const request = create(CreateInteractionRequestSchema, {
        id: interaction.id,
        title: interaction.title ?? '',
        asrOutput: JSON.stringify(
          interaction.asr_output || interaction.asrOutput,
        ),
        llmOutput: JSON.stringify(
          interaction.llm_output || interaction.llmOutput,
        ),
        rawAudio: uint8AudioData,
        durationMs: interaction.duration_ms || interaction.durationMs || 0,
      })

      console.log(
        '[gRPC Client] Sending request with audio size:',
        request.rawAudio.length,
        'duration:',
        request.durationMs,
        'ms',
      )

      return await this.client.createInteraction(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async updateInteraction(interaction: Partial<InteractionPb>) {
    return this.withRetry(async () => {
      const request = create(UpdateInteractionRequestSchema, {
        id: interaction.id,
        title: interaction.title ?? '',
      })
      return await this.client.updateInteraction(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async deleteInteraction(interaction: Partial<InteractionPb>) {
    return this.withRetry(async () => {
      const request = create(DeleteInteractionRequestSchema, {
        id: interaction.id,
      })
      return await this.client.deleteInteraction(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async listInteractionsSince(since?: string): Promise<InteractionPb[]> {
    return this.withRetry(async () => {
      const request = create(ListInteractionsRequestSchema, {
        sinceTimestamp: since ?? '',
      })
      const response = await this.client.listInteractions(request, {
        headers: this.getHeaders(),
      })
      return response.interactions
    })
  }

  async createDictionaryItem(item: Partial<DictionaryItemPb>) {
    return this.withRetry(async () => {
      const request = create(CreateDictionaryItemRequestSchema, {
        id: item.id,
        word: item.word,
        pronunciation: item.pronunciation ?? '',
      })
      return await this.client.createDictionaryItem(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async updateDictionaryItem(item: Partial<DictionaryItemPb>) {
    return this.withRetry(async () => {
      const request = create(UpdateDictionaryItemRequestSchema, {
        id: item.id,
        word: item.word,
        pronunciation: item.pronunciation ?? '',
      })
      return await this.client.updateDictionaryItem(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async deleteDictionaryItem(item: Partial<DictionaryItemPb>) {
    return this.withRetry(async () => {
      const request = create(DeleteDictionaryItemRequestSchema, {
        id: item.id,
      })
      return await this.client.deleteDictionaryItem(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async listDictionaryItemsSince(since?: string): Promise<DictionaryItemPb[]> {
    return this.withRetry(async () => {
      const request = create(ListDictionaryItemsRequestSchema, {
        sinceTimestamp: since ?? '',
      })
      const response = await this.client.listDictionaryItems(request, {
        headers: this.getHeaders(),
      })
      return response.items
    })
  }

  async deleteUserData() {
    return this.withRetry(async () => {
      const request = create(DeleteUserDataRequestSchema, {})
      return await this.client.deleteUserData(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async getAdvancedSettings(): Promise<AdvancedSettingsPb | null> {
    return this.withRetry(async () => {
      const request = create(GetAdvancedSettingsRequestSchema, {})
      return await this.client.getAdvancedSettings(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async updateAdvancedSettings(
    settings: AdvancedSettings,
  ): Promise<AdvancedSettingsPb | null> {
    // Check if user is self-hosted and skip server sync
    const userId = getCurrentUserId()
    const isSelfHosted = userId === 'self-hosted'

    if (isSelfHosted) {
      console.log(
        'Self-hosted user detected, skipping server sync for advanced settings',
      )
      // Return null for self-hosted users since settings are stored locally
      return null
    }

    console.log('Updating advanced settings:', settings.llm)

    return this.withRetry(async () => {
      const request = create(UpdateAdvancedSettingsRequestSchema, {
        llm: {
          asrModel: settings.llm.asrModel ?? undefined,
          asrProvider: settings.llm.asrProvider ?? undefined,
          asrPrompt: settings.llm.asrPrompt ?? undefined,
          llmProvider: settings.llm.llmProvider ?? undefined,
          llmModel: settings.llm.llmModel ?? undefined,
          transcriptionPrompt: settings.llm.transcriptionPrompt ?? undefined,
          editingPrompt: settings.llm.editingPrompt ?? undefined,
          llmTemperature: settings.llm.llmTemperature ?? undefined,
          noSpeechThreshold: settings.llm.noSpeechThreshold ?? undefined,
          asrApiKey: settings.llm.asrApiKey ?? undefined,
          llmApiKey: settings.llm.llmApiKey ?? undefined,
        },
      })
      return await this.client.updateAdvancedSettings(request, {
        headers: this.getHeaders(),
      })
    })
  }

  async submitTimingReports(reports: TimingReport[]) {
    return this.withRetry(async () => {
      const request = create(SubmitTimingReportsRequestSchema, {
        reports,
      })
      return await this.timingClient.submitTimingReports(request, {
        headers: this.getHeaders(),
      })
    })
  }
}

export const grpcClient = new GrpcClient()
