import React, { useCallback, useEffect, useState } from 'react'
import { ChartNoAxesColumn, InfoCircle, Copy, Check } from '@mynaui/icons-react'
import { EXTERNAL_LINKS } from '@/lib/constants/external-links'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import { useAuthStore } from '@/app/store/useAuthStore'
import { Interaction as InteractionPb } from '@/app/generated/ito_pb'
import { TotalWordsIcon } from '../../icons/TotalWordsIcon'
import { SpeedIcon } from '../../icons/SpeedIcon'
import {
  STREAK_MESSAGES,
  SPEED_MESSAGES,
  TOTAL_WORDS_MESSAGES,
  getStreakLevel,
  getSpeedLevel,
  getTotalWordsLevel,
  getActivityMessage,
} from './activityMessages'
import { ItoMode } from '@/app/generated/ito_pb'
import { getKeyDisplay } from '@/app/utils/keyboard'
import { KeyName } from '@/lib/types/keyboard'
import { usePlatform } from '@/app/hooks/usePlatform'
import {
  calculateAllStats,
  InteractionStats,
  Interaction,
} from '@/app/utils/userMetrics'

const StatCard = ({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}) => {
  return (
    <div className="flex flex-col p-4 w-1/3 border-2 border-neutral-100 rounded-xl gap-4">
      <div className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <div>{title}</div>
          <div className="font-bold">{value}</div>
        </div>
        <div className="flex flex-col items-end flex-1">{icon}</div>
      </div>
      <div className="w-full text-neutral-400">{description}</div>
    </div>
  )
}

export default function HomeContent() {
  const { getItoModeShortcuts } = useSettingsStore()
  const keyboardShortcut = getItoModeShortcuts(ItoMode.TRANSCRIBE)[0].keys
  const { user } = useAuthStore()
  const firstName = user?.name?.split(' ')[0]
  const platform = usePlatform()
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null)
  const [stats, setStats] = useState<InteractionStats>({
    streakDays: 0,
    totalWords: 0,
    weeklyWords: 0,
    averageWPM: 0,
  })

  const formatStreakText = (days: number): string => {
    if (days === 0) return '0 days'
    if (days === 1) return '1 day'
    if (days < 7) return `${days} days`
    if (days < 14) return '1 week'
    if (days < 30) return `${Math.floor(days / 7)} weeks`
    if (days < 60) return '1 month'
    return `${Math.floor(days / 30)} months`
  }

  const loadInteractions = useCallback(async () => {
    try {
      const allRawInteractions =
        (await window.api.interactions.getAll()) as unknown as InteractionPb[]

      const allInteractions: Interaction[] = allRawInteractions.map(
        (i: InteractionPb) => {
          let asrOutput = {}
          try {
            asrOutput =
              typeof i.asrOutput === 'string'
                ? JSON.parse(i.asrOutput)
                : i.asrOutput
          } catch (e) {
            /* ignore */
          }

          let llmOutput = {}
          try {
            llmOutput =
              typeof i.llmOutput === 'string'
                ? JSON.parse(i.llmOutput)
                : i.llmOutput
          } catch (e) {
            /* ignore */
          }

          return {
            id: i.id,
            user_id: i.userId,
            created_at: i.createdAt,
            updated_at: i.updatedAt,
            asr_output: asrOutput,
            llm_output: llmOutput,
            duration_ms: i.durationMs,
            sample_rate: 16000,
            title: i.title,
          } as Interaction
        },
      )

      // Sort by creation date (newest first) - remove the slice(0, 10) to show all interactions
      const sortedInteractions = allInteractions.sort(
        (a: Interaction, b: Interaction) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      setInteractions(sortedInteractions)

      // Calculate and set statistics
      const calculatedStats = calculateAllStats(sortedInteractions)
      setStats(calculatedStats)
    } catch (error) {
      console.error('Failed to load interactions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInteractions()

    // Listen for new interactions
    const handleInteractionCreated = () => {
      loadInteractions()
    }

    const unsubscribe = window.api.on(
      'interaction-created',
      handleInteractionCreated,
    )

    // Cleanup listener on unmount
    return unsubscribe
  }, [loadInteractions])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return 'TODAY'
    if (isYesterday) return 'YESTERDAY'

    return date
      .toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
      .toUpperCase()
  }

  const groupInteractionsByDate = (interactions: Interaction[]) => {
    const groups: { [key: string]: Interaction[] } = {}

    interactions.forEach(interaction => {
      const dateKey = formatDate(interaction.created_at)
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(interaction)
    })

    return groups
  }

  const getDisplayText = (interaction: Interaction) => {
    // Check for errors first
    if (interaction.asr_output?.error) {
      // Prefer precise error code mapping when available
      const code = interaction.asr_output?.errorCode
      if (code === 'CLIENT_TRANSCRIPTION_QUALITY_ERROR') {
        return {
          text: 'Audio quality too low',
          isError: true,
          tooltip:
            'Audio quality was too low to generate a reliable transcript',
        }
      }
      if (
        interaction.asr_output.error.includes('No speech detected in audio.') ||
        interaction.asr_output.error.includes('Unable to transcribe audio.')
      ) {
        return {
          text: 'Audio is silent',
          isError: true,
          tooltip:
            "SmartSpeaky didn't detect any words so the transcript is empty",
        }
      }
      return {
        text: 'Transcription failed',
        isError: true,
        tooltip: interaction.asr_output.error,
      }
    }

    // Check for empty transcript
    const transcript = interaction.asr_output?.transcript?.trim()

    if (!transcript) {
      return {
        text: 'Audio is silent.',
        isError: true,
        tooltip:
          "SmartSpeaky didn't detect any words so the transcript is empty",
      }
    }

    // Return the actual transcript
    return {
      text: transcript,
      isError: false,
      tooltip: null,
    }
  }

  const groupedInteractions = groupInteractionsByDate(interactions)

  const copyToClipboard = async (text: string, interactionId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems(prev => new Set(prev).add(interactionId))
      setOpenTooltipKey(`copy:${interactionId}`) // Keep tooltip open

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(interactionId)
          return newSet
        })
        // Close tooltip if it's still open for this item (do not override if user hovered elsewhere)
        setOpenTooltipKey(prev =>
          prev === `copy:${interactionId}` ? null : prev,
        )
      }, 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Fixed Header Content */}
      <div className="flex-shrink-0 px-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium">
              Welcome back{firstName ? `, ${firstName}!` : '!'}
            </h1>
          </div>
        </div>
        <div className="flex gap-4 w-full mb-6">
          <div className="flex w-full items-center text-sm text-gray-700 gap-2">
            <StatCard
              title="Weekly Streak"
              value={formatStreakText(stats.streakDays)}
              description={getActivityMessage(
                STREAK_MESSAGES,
                getStreakLevel(stats.streakDays),
              )}
              icon={
                <div className="p-2 bg-blue-50 rounded-md">
                  <ChartNoAxesColumn
                    className="w-6 h-6 text-blue-400 border-2 p-1 rounded-full"
                    strokeWidth={4}
                  />
                </div>
              }
            />
            <StatCard
              title="Average Speed"
              value={`${stats.averageWPM} words / minute`}
              description={getActivityMessage(
                SPEED_MESSAGES,
                getSpeedLevel(stats.averageWPM),
              )}
              icon={
                <div className="p-2 bg-green-50 rounded-md">
                  <SpeedIcon />
                </div>
              }
            />
            <StatCard
              title="Total Words"
              value={`${stats.totalWords} ${stats.totalWords === 1 ? 'word' : 'words'}`}
              description={getActivityMessage(
                TOTAL_WORDS_MESSAGES,
                getTotalWordsLevel(stats.totalWords),
              )}
              icon={
                <div className="p-2 bg-orange-50 rounded-md">
                  <TotalWordsIcon />
                </div>
              }
            />
          </div>
        </div>

        {/* Dictation Info Box */}
        <div className="bg-slate-100 rounded-xl p-6 flex items-center justify-between mb-10">
          <div>
            <div className="text-base font-medium mb-1">
              Voice dictation in any app
            </div>
            <div className="text-sm text-gray-600">
              <span key="hold-down">Hold down the trigger key </span>
              {keyboardShortcut.map((key, index) => (
                <React.Fragment key={index}>
                  <span className="bg-slate-50 px-1 py-0.5 rounded text-xs font-mono shadow-sm">
                    {getKeyDisplay(key as KeyName, platform, {
                      showDirectionalText: false,
                      format: 'label',
                    })}
                  </span>
                  <span>{index < keyboardShortcut.length - 1 && ' + '}</span>
                </React.Fragment>
              ))}
              <span key="and"> and speak into any textbox</span>
            </div>
          </div>
          <button
            className="bg-gray-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 cursor-pointer"
            onClick={() =>
              window.api?.invoke('web-open-url', EXTERNAL_LINKS.WEBSITE)
            }
          >
            Explore use cases
          </button>
        </div>

        {/* Recent Activity Header */}
        <div className="text-sm text-muted-foreground mb-6">
          Recent activity
        </div>
      </div>

      {/* Scrollable Recent Activity Section */}
      <div className="flex-1 px-24 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-gray-500">
            Loading recent activity...
          </div>
        ) : interactions.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-gray-500">
            <p className="text-sm">No interactions yet</p>
            <p className="text-xs mt-1">
              Try using voice dictation by pressing{' '}
              {keyboardShortcut.join(' + ')}
            </p>
          </div>
        ) : (
          Object.entries(groupedInteractions).map(
            ([dateLabel, dateInteractions]) => (
              <div key={dateLabel} className="mb-6">
                <div className="text-xs text-gray-500 mb-4">{dateLabel}</div>
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
                  {dateInteractions.map(interaction => {
                    const displayInfo = getDisplayText(interaction)

                    return (
                      <div
                        key={interaction.id}
                        className="flex items-center justify-between px-4 py-4 gap-10 hover:bg-gray-50 transition-colors duration-200 group"
                      >
                        <div className="flex items-center gap-10">
                          <div className="text-gray-600 min-w-[60px]">
                            {formatTime(interaction.created_at)}
                          </div>
                          <div
                            className={`${displayInfo.isError ? 'text-gray-600' : 'text-gray-900'} flex items-center gap-1`}
                          >
                            {displayInfo.text}
                            {displayInfo.tooltip && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <InfoCircle className="w-4 h-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {displayInfo.tooltip}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>

                        {/* Copy button - only show on hover */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Copy button */}
                          {!displayInfo.isError && (
                            <Tooltip
                              open={openTooltipKey === `copy:${interaction.id}`}
                              onOpenChange={open => {
                                if (open) {
                                  // Opening: exclusively show this tooltip
                                  setOpenTooltipKey(`copy:${interaction.id}`)
                                } else {
                                  // Closing: if in copied state, keep it open until timer clears,
                                  // otherwise close normally
                                  if (!copiedItems.has(interaction.id)) {
                                    setOpenTooltipKey(prev =>
                                      prev === `copy:${interaction.id}`
                                        ? null
                                        : prev,
                                    )
                                  }
                                }
                              }}
                            >
                              <TooltipTrigger asChild>
                                <button
                                  className={`p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer ${
                                    copiedItems.has(interaction.id)
                                      ? 'text-green-600'
                                      : 'text-gray-600'
                                  }`}
                                  onClick={() =>
                                    copyToClipboard(
                                      displayInfo.text,
                                      interaction.id,
                                    )
                                  }
                                >
                                  {copiedItems.has(interaction.id) ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={5}>
                                {copiedItems.has(interaction.id)
                                  ? 'Copied 🎉'
                                  : 'Copy'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  )
}
