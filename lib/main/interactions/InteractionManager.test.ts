import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { STORE_KEYS } from '../../constants/store-keys'

const mockCreateInteraction = mock(async (_payload: any) => ({ id: 'created-id' }))

mock.module('../../clients/grpcClient', () => ({
  grpcClient: {
    createInteraction: mockCreateInteraction,
  },
}))

const mockMainStore = {
  get: mock((_key?: string) => ({ id: 'test-user-123' } as any)),
}
mock.module('../store', () => ({
  default: mockMainStore,
}))

mock.module('electron-log', () => ({
  default: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}))

mock.module('../timing/TimingCollector', () => ({
  timingCollector: {
    clearInteraction: mock(),
  },
}))

import { BrowserWindow } from 'electron'
import { InteractionManager } from './InteractionManager'

describe('InteractionManager', () => {
  let interactionManager: InteractionManager

  beforeEach(() => {
    interactionManager = new InteractionManager()
    mockCreateInteraction.mockClear()
    mockMainStore.get.mockClear()
    mockMainStore.get.mockReturnValue({ id: 'test-user-123' })
    ;(BrowserWindow as any).getAllWindows = () => []
  })

  describe('Interaction Lifecycle', () => {
    test('should start interaction and generate ID', () => {
      const id = interactionManager.initialize()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(interactionManager.getCurrentInteractionId()).toBe(id)
    })

    test('should track start time', () => {
      const beforeStart = Date.now()
      interactionManager.initialize()
      const afterStart = Date.now()

      const startTime = interactionManager.getInteractionStartTime()
      expect(startTime).toBeGreaterThanOrEqual(beforeStart)
      expect(startTime).toBeLessThanOrEqual(afterStart)
    })

    test('should clear current interaction', () => {
      interactionManager.initialize()
      expect(interactionManager.getCurrentInteractionId()).not.toBeNull()

      interactionManager.clearCurrentInteraction()
      expect(interactionManager.getCurrentInteractionId()).toBeNull()
      expect(interactionManager.getInteractionStartTime()).toBeNull()
    })
  })

  describe('Interaction Creation', () => {
    test('should create interaction with all data', async () => {
      const transcript = 'Hello world'
      const audioBuffer = Buffer.from('audio-data')
      const sampleRate = 16000

      interactionManager.initialize()
      await interactionManager.createInteraction(
        transcript,
        audioBuffer,
        sampleRate,
      )

      expect(mockCreateInteraction).toHaveBeenCalled()
      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.user_id).toBe('test-user-123')
      expect(payload.sample_rate).toBe(sampleRate)
      expect(payload.raw_audio).toEqual(audioBuffer)
      expect(payload.asr_output.transcript).toBe(transcript)
    })

    test('should skip creation when no current interaction ID', async () => {
      await interactionManager.createInteraction(
        'test',
        Buffer.from('audio'),
        16000,
      )

      expect(mockCreateInteraction).not.toHaveBeenCalled()
    })

    test('should skip creation when no user ID', async () => {
      mockMainStore.get.mockReturnValue(null)

      interactionManager.initialize()
      await interactionManager.createInteraction(
        'test',
        Buffer.from('audio'),
        16000,
      )

      expect(mockMainStore.get).toHaveBeenCalledWith(STORE_KEYS.USER_PROFILE)
      expect(mockCreateInteraction).not.toHaveBeenCalled()
    })
  })

  describe('Title Generation', () => {
    test('should use transcript as title for short transcripts', async () => {
      const transcript = 'Short message'
      interactionManager.initialize()
      await interactionManager.createInteraction(
        transcript,
        Buffer.from('audio'),
        16000,
      )

      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.title).toBe(transcript)
    })

    test('should truncate long transcripts at 50 characters', async () => {
      const longTranscript =
        'This is a very long transcript that should be truncated because it exceeds fifty characters'

      interactionManager.initialize()
      await interactionManager.createInteraction(
        longTranscript,
        Buffer.from('audio'),
        16000,
      )

      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.title).toBe(
        'This is a very long transcript that should be trun...',
      )
      expect(payload.title.length).toBe(53)
    })

    test('should use fallback title for empty transcript', async () => {
      interactionManager.initialize()
      await interactionManager.createInteraction(
        '',
        Buffer.from('audio'),
        16000,
      )

      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.title).toBe('Voice interaction')
    })
  })

  describe('Duration and Audio Handling', () => {
    test('should calculate duration from start time', async () => {
      interactionManager.initialize()
      await new Promise(resolve => setTimeout(resolve, 10))

      await interactionManager.createInteraction(
        'test',
        Buffer.from('audio'),
        16000,
      )

      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.duration_ms).toBeGreaterThan(0)
      expect(payload.duration_ms).toBeLessThan(2000)
    })

    test('should set duration 0 when start time is missing', async () => {
      const manager = new InteractionManager()
      ;(manager as any).currentInteractionId = 'test-id'
      ;(manager as any).interactionStartTime = null

      await manager.createInteraction('test', Buffer.from('audio'), 16000)

      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.duration_ms).toBe(0)
    })

    test('should set null for empty audio buffer', async () => {
      interactionManager.initialize()
      await interactionManager.createInteraction('test', Buffer.alloc(0), 16000)

      const payload = mockCreateInteraction.mock.calls[0][0] as any
      expect(payload.raw_audio).toBeNull()
    })
  })
})
