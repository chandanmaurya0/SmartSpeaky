import { describe, test, expect, beforeEach, mock } from 'bun:test'

const mockEnsureValidTokens = mock(async () => ({
  success: true,
  tokens: { access_token: 'token' },
}))

const mockGetCurrentUserId = mock(() => 'test-user-id')

const mockGrpcClient = {
  listNotesSince: mock(async () => [{ id: '1', content: 'Test note' }]),
  deleteUserData: mock(async () => true),
  updateAdvancedSettings: mock(async (settings: any) => settings),
  getAdvancedSettings: mock(async () => ({ llm: {} })),
}

mock.module('../auth/events', () => ({
  ensureValidTokens: mockEnsureValidTokens,
  generateNewAuthState: mock(),
  exchangeAuthCode: mock(),
  handleLogin: mock(),
  handleLogout: mock(),
}))

mock.module('../auth/config', () => ({
  Auth0Config: { domain: 'test.auth0.com', clientId: 'client-id' },
  Auth0Connections: {},
}))

mock.module('../main/store', () => ({
  createNewAuthState: mock(() => ({
    id: 'state-id',
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    state: 'state',
  })),
  initializeStore: mock(async () => {}),
  default: {
    get: mock(),
    set: mock(),
    delete: mock(),
  },
  store: {
    get: mock(),
    set: mock(),
    delete: mock(),
  },
  getCurrentUserId: mockGetCurrentUserId,
  getAdvancedSettings: mock(() => ({
    llm: {
      asrProvider: 'groq',
      asrModel: 'whisper-large-v3',
      asrPrompt: '',
      llmProvider: 'groq',
      llmModel: 'openai/gpt-oss-120b',
      llmTemperature: 0.1,
      transcriptionPrompt: '',
      editingPrompt: '',
      noSpeechThreshold: 0.6,
      asrApiKey: '',
      llmApiKey: '',
    },
    grammarServiceEnabled: false,
    macosAccessibilityContextEnabled: false,
  })),
}))

mock.module('../clients/grpcClient', () => ({
  grpcClient: mockGrpcClient,
}))

const { registerIPC } = await import('./ipcEvents')
const { ipcMain, systemPreferences, BrowserWindow } = await import('electron')

describe('IPC Events Critical Business Logic Tests', () => {
  let registeredHandlers: Map<string, (...args: any[]) => any>

  beforeEach(() => {
    registeredHandlers = new Map()

    mockEnsureValidTokens.mockClear()
    mockGetCurrentUserId.mockClear()
    Object.values(mockGrpcClient).forEach(fn => (fn as any).mockClear())

    const originalHandle = (ipcMain as any).handle
    ;(ipcMain as any).handle = (
      channel: string,
      handler: (...args: any[]) => any,
    ) => {
      registeredHandlers.set(channel, handler)
      return originalHandle(channel, handler)
    }

    registerIPC()
  })

  test('should handle token refresh errors gracefully', async () => {
    mockEnsureValidTokens.mockImplementationOnce(async () => {
      throw new Error('Token refresh failed')
    })

    const handler = registeredHandlers.get('refresh-tokens')
    expect(handler).toBeDefined()

    const result = await handler!()
    expect(result).toEqual({
      success: false,
      error: 'Token refresh failed',
    })
  })

  test('should handle microphone permission with prompt', async () => {
    const handler = registeredHandlers.get('check-microphone-permission')
    expect(handler).toBeDefined()

    const originalAsk = (systemPreferences as any).askForMediaAccess
    ;(systemPreferences as any).askForMediaAccess = async () => true

    const result = await handler!({}, true)
    expect(result).toBe(true)

    ;(systemPreferences as any).askForMediaAccess = originalAsk
  })

  test('should handle window maximize toggle correctly', async () => {
    const handler = registeredHandlers.get('window-maximize-toggle')
    expect(handler).toBeDefined()

    const originalFromWebContents = (BrowserWindow as any).fromWebContents
    const mockWindow = {
      isMaximized: () => true,
      unmaximize: mock(),
      maximize: mock(),
    }
    ;(BrowserWindow as any).fromWebContents = () => mockWindow

    await handler!({ sender: 'mock' })
    expect(mockWindow.unmaximize).toHaveBeenCalled()

    ;(BrowserWindow as any).fromWebContents = originalFromWebContents
  })

  test('should return notes from grpc client for notes:get-all', async () => {
    const handler = registeredHandlers.get('notes:get-all')
    expect(handler).toBeDefined()

    const result = await handler!()
    expect(mockGrpcClient.listNotesSince).toHaveBeenCalled()
    expect(result).toEqual([{ id: '1', content: 'Test note' }])
  })

  test('should handle missing user ID for delete-user-data', async () => {
    mockGetCurrentUserId.mockReturnValueOnce(null)

    const handler = registeredHandlers.get('delete-user-data')
    expect(handler).toBeDefined()

    const result = await handler!({})
    expect(result).toBe(false)
    expect(mockGrpcClient.deleteUserData).not.toHaveBeenCalled()
  })

  test('update-advanced-settings should call grpc client', async () => {
    const handler = registeredHandlers.get('update-advanced-settings')
    const mockSettings = { llm: { llmProvider: 'groq' } }

    expect(handler).toBeDefined()
    const result = await handler!({}, mockSettings)

    expect(mockGrpcClient.updateAdvancedSettings).toHaveBeenCalledWith(
      mockSettings,
    )
    expect(result).toEqual(mockSettings)
  })
})
