import {
  LlmSettings,
  useAdvancedSettingsStore,
} from '@/app/store/useAdvancedSettingsStore'
import { ChangeEvent, useState, useCallback, memo } from 'react'
import { useWindowContext } from '@/app/components/window/WindowContext'

type LlmSettingConfig = {
  name: keyof LlmSettings
  label: string
  placeholder: string
  description: string
  maxLength: number
  resize?: boolean
  readOnly?: boolean
  isSelect?: boolean
  options?: string[]
}

const modelProviderLengthLimit = 30
const floatLengthLimit = 4
const asrPromptLengthLimit = 100
const llmPromptLengthLimit = 1500

// Define provider-specific model options
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'llama3.1-70b',
  'llama3.1-8b',
]

const CEREBRAS_MODELS = [
  'llama3.1-8b',
  'llama-3.3-70b',
  'gpt-oss-120b',
  'qwen-3-32b',
]

const getLlmSettingsConfig = (
  currentSettings: LlmSettings,
): LlmSettingConfig[] => {
  // Determine available models based on selected provider
  // Default to Groq models if no provider is selected or provider is unknown
  const llmModels =
    currentSettings.llmProvider === 'cerebras' ? CEREBRAS_MODELS : GROQ_MODELS

  return [
    {
      name: 'asrProvider',
      label: 'ASR Provider',
      placeholder: 'Select ASR provider',
      description: 'Speech-to-text provider for audio transcription',
      maxLength: modelProviderLengthLimit,
      isSelect: true,
      options: ['groq'],
    },
    {
      name: 'asrModel',
      label: 'ASR Model',
      placeholder: 'Select ASR model',
      description: 'The ASR model used for speech-to-text transcription',
      maxLength: modelProviderLengthLimit,
      isSelect: true,
      options: [
        'whisper-large-v3',
        'whisper-large-v3-turbo',
        'distil-whisper-large-v3-en',
      ],
    },
    {
      name: 'asrApiKey',
      label: 'ASR Provider API Key',
      placeholder: 'Enter your ASR API key',
      description: 'Provide an API key for the selected ASR provider.',
      maxLength: 100,
    },
    {
      name: 'asrPrompt',
      label: 'ASR Prompt',
      placeholder: 'Enter custom ASR prompt',
      description:
        'A custom prompt to guide the ASR transcription process for better accuracy. Dictionary will be appended. (Leave empty for default)',
      maxLength: asrPromptLengthLimit,
      resize: true,
    },
    {
      name: 'llmProvider',
      label: 'LLM Provider',
      placeholder: 'Select LLM provider',
      description: 'LLM provider for text generation tasks',
      maxLength: modelProviderLengthLimit,
      isSelect: true,
      options: ['groq', 'cerebras'],
    },
    {
      name: 'llmModel',
      label: 'LLM Model',
      placeholder: 'Select LLM model',
      description: 'The LLM model used for text generation tasks',
      maxLength: modelProviderLengthLimit,
      isSelect: true,
      options: llmModels,
    },
    {
      name: 'llmApiKey',
      label: 'LLM Provider API Key',
      placeholder: 'Enter your LLM API key',
      description: 'Provide an API key for the selected LLM provider.',
      maxLength: 100,
    },
    {
      name: 'llmTemperature',
      label: 'LLM Temperature',
      placeholder: 'Enter LLM temperature (e.g., 0.7)',
      description:
        'Controls the randomness of the LLM output. Higher values produce more diverse results.',
      maxLength: floatLengthLimit,
    },
    {
      name: 'transcriptionPrompt',
      label: 'Transcription Prompt',
      placeholder: 'Enter custom transcription prompt',
      description:
        'A custom prompt to guide the transcription process for better accuracy. (Leave empty for default)',
      maxLength: llmPromptLengthLimit,
      resize: true,
    },
    // This is being removed until long term solution for versioning prompts is implemented
    // https://github.com/heyito/ito/issues/174
    // {
    //   name: 'editingPrompt',
    //   label: 'Editing Prompt',
    //   placeholder: 'Enter custom editing prompt',
    //   description:
    //     'A custom prompt to guide the editing process for improved text quality. (Leave empty for default)',
    //   maxLength: llmPromptLengthLimit,
    //   resize: true,
    // },
    {
      name: 'noSpeechThreshold',
      label: 'No Speech Threshold',
      placeholder: 'e.g., 0.6',
      description: 'Threshold for detecting no speech segments in audio.',
      maxLength: floatLengthLimit,
    },
  ]
}

function formatDisplayValue(value: string | number | null): string {
  if (value === null) {
    return ''
  }
  // If its a number then format it to 2 decimal places
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return value
}

interface SettingInputProps {
  config: LlmSettingConfig
  value: string | number | null
  onChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    config: LlmSettingConfig,
  ) => void
}

const SettingInput = memo(function SettingInput({
  config,
  value,
  onChange,
}: SettingInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [editingValue, setEditingValue] = useState('')

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const newValue = e.target.value
      setEditingValue(newValue)
      onChange(e, config)
    },
    [onChange, config],
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    // Start with the formatted display value to avoid jarring transition
    const startValue = formatDisplayValue(value)
    setEditingValue(startValue)
  }, [value])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    setEditingValue('')
  }, [])

  const displayValue = isFocused ? editingValue : formatDisplayValue(value)

  return (
    <div className="mb-5">
      <label
        htmlFor={config.name}
        className="block text-sm font-medium text-slate-700 mb-1 ml-1"
      >
        {config.label}
      </label>
      {config.isSelect ? (
        <select
          id={config.name}
          value={value ?? ''}
          onChange={handleChange}
          className="w-3/4 ml-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={config.readOnly}
        >
          {config.options?.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={config.name}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-3/4 ml-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={config.placeholder}
          maxLength={config.maxLength}
          readOnly={config.readOnly}
        />
      )}
      <p className="w-3/4 text-xs text-slate-500 mt-1 ml-1">
        {config.description}
      </p>
    </div>
  )
})

export default function AdvancedSettingsContent() {
  const {
    llm,
    defaults,
    grammarServiceEnabled,
    macosAccessibilityContextEnabled,
    setLlmSettings,
    setGrammarServiceEnabled,
    setMacosAccessibilityContextEnabled,
  } = useAdvancedSettingsStore()
  const windowContext = useWindowContext()

  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Helper to resolve null to actual default value for display
  const getDisplayValue = useCallback(
    (key: keyof LlmSettings): string | number | null => {
      const value = llm[key]
      if (value === null && defaults) {
        return defaults[key] ?? null
      }
      return value
    },
    [llm, defaults],
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSavedSuccess(false)

    // Resolve any null/empty values with defaults before saving
    // This ensures we persist the actual configuration the user sees
    const resolvedLlm = { ...llm }
    if (defaults) {
      for (const key of Object.keys(resolvedLlm) as Array<keyof LlmSettings>) {
        const val = resolvedLlm[key]
        if (
          (val === null || val === '') &&
          defaults[key] !== undefined &&
          defaults[key] !== null
        ) {
          // Verify if we should override empty strings.
          // For providers and models, yes. For prompts/API keys, maybe not if user intentionally cleared them?
          // But given current behavior where emptiness causes issues, resolving to default seems safer for main configs.

          // Special handling: Don't override API key if it's empty (user might want to clear it)
          if ((key === 'asrApiKey' || key === 'llmApiKey') && val === '') {
            continue
          }

          // @ts-ignore
          resolvedLlm[key] = defaults[key]
        }
      }
    }

    const settingsToSave = {
      llm: resolvedLlm,
      grammarServiceEnabled,
      macosAccessibilityContextEnabled,
    }
    await window.api.updateAdvancedSettings(settingsToSave)

    setIsSaving(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)

    // Optional: Add a toast notification here
    console.log('Settings saved:', settingsToSave)
  }, [llm, defaults, grammarServiceEnabled, macosAccessibilityContextEnabled])

  const handleInputChange = useCallback(
    (
      e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
      config: LlmSettingConfig,
    ) => {
      const rawValue = e.target.value

      // Determine if this field should be a number
      const isNumericField =
        config.name === 'llmTemperature' || config.name === 'noSpeechThreshold'

      // Parse the value appropriately
      let newValue: string | number | null
      if (rawValue === '') {
        newValue = null
      } else if (isNumericField) {
        const parsed = parseFloat(rawValue)
        newValue = isNaN(parsed) ? null : parsed
      } else {
        newValue = rawValue
      }

      setLlmSettings({ [config.name]: newValue })
    },
    [llm, setLlmSettings],
  )

  const handleGrammarServiceToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const enabled = e.target.checked
      setGrammarServiceEnabled(enabled)
    },
    [setGrammarServiceEnabled],
  )

  const handleMacosAccessibilityContextToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const enabled = e.target.checked
      setMacosAccessibilityContextEnabled(enabled)
    },
    [setMacosAccessibilityContextEnabled],
  )

  const handleRestoreDefaults = useCallback(() => {
    const defaultLlmSettings: LlmSettings = {
      asrProvider: null,
      asrModel: null,
      asrPrompt: null,
      llmProvider: null,
      llmModel: null,
      llmTemperature: null,
      transcriptionPrompt: null,
      editingPrompt: null,
      noSpeechThreshold: null,
      asrApiKey: null,
      llmApiKey: null,
    }
    setLlmSettings(defaultLlmSettings)
  }, [setLlmSettings])

  return (
    <div className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-transparent">
      {/* LLM Settings Section */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3 ml-1 mr-1">
            <h3 className="text-md font-medium text-slate-900">LLM Settings</h3>
            <button
              onClick={handleRestoreDefaults}
              className="px-3 py-1 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Restore Defaults
            </button>
          </div>
          <div className="space-y-3">
            {getLlmSettingsConfig(llm).map(config => (
              <SettingInput
                key={config.name}
                config={config}
                value={getDisplayValue(config.name)}
                onChange={handleInputChange}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-md font-medium text-slate-900 mb-3 ml-1">
            Grammar
          </h3>
          <label className="flex items-start gap-3 ml-1">
            <input
              type="checkbox"
              checked={grammarServiceEnabled}
              onChange={handleGrammarServiceToggle}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">
                Enable Grammar Service
              </span>
              <span className="block text-xs text-slate-500 mt-1">
                Apply SmartSpeaky's local grammar adjustments before inserting
                text.
              </span>
            </span>
          </label>
        </div>

        {windowContext?.window?.platform === 'darwin' && (
          <div>
            <h3 className="text-md font-medium text-slate-900 mb-3 ml-1">
              Context
            </h3>
            <label className="flex items-start gap-3 ml-1">
              <input
                type="checkbox"
                checked={macosAccessibilityContextEnabled}
                onChange={handleMacosAccessibilityContextToggle}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-700">
                  Use Accessibility Context
                </span>
                <span className="block text-xs text-slate-500 mt-1">
                  Use Accessibility APIs to capture text context around the
                  cursor for improved accuracy.
                </span>
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center pb-6">
        <button
          onClick={handleSave}
          disabled={isSaving || savedSuccess}
          className={`w-1/2 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200
            ${
              savedSuccess
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }
            ${isSaving ? 'opacity-75 cursor-wait' : ''}
          `}
        >
          {isSaving ? 'Saving...' : savedSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
