import { performance } from 'perf_hooks'
import { InteractionTimingsRepository } from '../../db/repo.js'

/**
 * Enum for server-side timing events in the transcription pipeline
 */
export enum ServerTimingEventName {
  STREAM_COLLECTION = 'server_stream_collection',
  AUDIO_PROCESSING = 'server_audio_processing',
  ASR_TRANSCRIPTION = 'server_asr_transcription',
  LLM_ADJUSTMENT = 'server_llm_adjustment',
  TOTAL_PROCESSING = 'server_total_processing',
}

interface TimingEvent {
  name: string
  startMs: number
  endMs?: number
  durationMs?: number
}

interface TimingReport {
  interactionId: string
  userId: string
  events: TimingEvent[]
  source: 'server'
}

interface ActiveTiming {
  interactionId: string
  userId: string
  startTimestamp: string
  events: Map<ServerTimingEventName, TimingEvent>
}

/**
 * ServerTimingCollector for collecting server-side transcription pipeline timing data
 */
export class ServerTimingCollector {
  private activeTimings = new Map<string, ActiveTiming>()
  private completedReports: TimingReport[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private FIRST_EVENT = ServerTimingEventName.TOTAL_PROCESSING

  // Configuration - more aggressive flushing for server to reduce memory
  private readonly FLUSH_INTERVAL_MS = 2_000 // 2 seconds
  private readonly BATCH_SIZE = 5 // Smaller batches
  private readonly MAX_QUEUE_SIZE = 50

  constructor() {
    this.scheduleFlush()
    console.log('[ServerTimingCollector] Service initialized')
  }

  /**
   * Start a new timing session for a transcription request
   */
  startInteraction(interactionId?: string, userId?: string) {
    if (!interactionId) {
      console.warn(
        '[ServerTimingCollector] Cannot start timing: no interaction ID provided',
      )
      return
    }

    this.activeTimings.set(interactionId, {
      interactionId,
      userId: userId || 'unknown',
      startTimestamp: new Date().toISOString(),
      events: new Map(),
    })
  }

  /**
   * Start timing for a specific event
   */
  startTiming(eventName: ServerTimingEventName, interactionId?: string) {
    if (!interactionId) {
      return
    }

    const active = this.activeTimings.get(interactionId)
    if (!active) {
      console.warn(
        `[ServerTimingCollector] Cannot start timing for unknown interaction: ${interactionId}`,
      )
      return
    }

    const timingEvent: TimingEvent = {
      name: eventName,
      startMs: performance.now(),
    }
    active.events.set(eventName, timingEvent)
  }

  /**
   * End timing for a specific event
   */
  endTiming(eventName: ServerTimingEventName, interactionId?: string) {
    if (!interactionId) {
      return
    }

    const active = this.activeTimings.get(interactionId)
    if (!active) {
      console.warn(
        `[ServerTimingCollector] Cannot end timing for unknown interaction: ${interactionId}`,
      )
      return
    }

    const timingEvent = active.events.get(eventName)
    if (!timingEvent) {
      console.warn(
        `[ServerTimingCollector] Cannot end timing for unknown event: ${eventName}`,
      )
      return
    }

    timingEvent.endMs = performance.now()
    timingEvent.durationMs = timingEvent.endMs - timingEvent.startMs
  }

  /**
   * Finalize an interaction and move it to completed reports
   */
  finalizeInteraction(interactionId?: string) {
    if (!interactionId) {
      console.warn(
        '[ServerTimingCollector] Cannot finalize: no interaction ID provided',
      )
      return
    }

    const active = this.activeTimings.get(interactionId)
    if (!active) {
      console.warn(
        `[ServerTimingCollector] Cannot finalize unknown interaction: ${interactionId}`,
      )
      return
    }

    // Calculate total duration
    const events = Array.from(active.events.values())
    const firstEvent = events.find(e => e.name === this.FIRST_EVENT)
    const lastEvent = events.reduce((latest, event) => {
      const eventEnd = event.endMs || event.startMs
      const latestEnd = latest.endMs || latest.startMs
      return eventEnd > latestEnd ? event : latest
    }, events[0])

    const totalDuration = firstEvent
      ? (lastEvent.endMs || lastEvent.startMs) - firstEvent.startMs
      : 0

    // Create timing report
    const report: TimingReport = {
      interactionId,
      userId: active.userId,
      events,
      source: 'server',
    }

    // Remove from active and add to completed
    this.activeTimings.delete(interactionId)
    this.completedReports.push(report)

    // Enforce max queue size
    if (this.completedReports.length > this.MAX_QUEUE_SIZE) {
      console.warn(
        `[ServerTimingCollector] Queue size exceeded ${this.MAX_QUEUE_SIZE}, dropping oldest reports`,
      )
      this.completedReports = this.completedReports.slice(-this.MAX_QUEUE_SIZE)
    }

    console.log(
      `[ServerTimingCollector] Finalized interaction: ${interactionId} (${events.length} events, ${totalDuration}ms total)`,
    )

    // Check if we should flush
    if (this.completedReports.length >= this.BATCH_SIZE) {
      this.flush()
    }
  }

  /**
   * Clear an interaction without finalizing (for errors/cancellations)
   */
  clearInteraction(interactionId?: string) {
    if (!interactionId) {
      return
    }

    this.activeTimings.delete(interactionId)
    console.log(`[ServerTimingCollector] Cleared interaction: ${interactionId}`)
  }

  /**
   * Flush completed reports to S3
   */
  async flush({ flushAll = false } = {}) {
    if (this.completedReports.length === 0) {
      return
    }

    const reportsToSend = this.completedReports.splice(
      0,
      flushAll ? this.completedReports.length : this.BATCH_SIZE,
    )

    console.log(
      `[ServerTimingCollector] Flushing ${reportsToSend.length} timing reports to DB`,
    )

    // Flatten reports into timing rows
    const allTimings: {
      interactionId: string
      userId: string
      eventName: string
      durationMs: number
    }[] = []

    for (const report of reportsToSend) {
      for (const event of report.events) {
        allTimings.push({
          interactionId: report.interactionId,
          userId: report.userId || 'unknown',
          eventName: event.name,
          durationMs: event.durationMs || 0,
        })
      }
    }

    try {
      await InteractionTimingsRepository.createMany(allTimings)
      console.log(
        `[ServerTimingCollector] Successfully saved ${allTimings.length} timing records for ${reportsToSend.length} interactions`,
      )
    } catch (error) {
      console.error(
        '[ServerTimingCollector] Failed to save timings to DB:',
        error,
      )
      // Re-add failed reports to the front of the queue for retry
      this.completedReports.unshift(...reportsToSend)
    }
  }

  /**
   * Schedule periodic flushing
   */
  private scheduleFlush() {
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => {
        this.flush()
      }, this.FLUSH_INTERVAL_MS)
    }
  }

  /**
   * Stop periodic flushing and flush any remaining reports
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // Flush any remaining reports
    await this.flush({ flushAll: true })

    console.log('[ServerTimingCollector] Service shutdown complete')
  }

  /**
   * Utility function to wrap an async operation with automatic timing
   * Handles both successful and error cases automatically
   */
  async timeAsync<T>(
    eventName: ServerTimingEventName,
    fn: () => Promise<T> | T,
    interactionId?: string,
  ): Promise<T> {
    this.startTiming(eventName, interactionId)
    try {
      const result = await fn()
      return result
    } finally {
      // Always end timing, even if the function throws
      this.endTiming(eventName, interactionId)
    }
  }
}

export const serverTimingCollector = new ServerTimingCollector()
