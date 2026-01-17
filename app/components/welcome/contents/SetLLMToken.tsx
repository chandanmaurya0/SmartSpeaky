import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Key, ChevronDown, Cpu, Mic, CheckCircle } from 'lucide-react'
import { useOnboardingStore } from '@/app/store/useOnboardingStore'
import { useAdvancedSettingsStore } from '@/app/store/useAdvancedSettingsStore'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

const ASR_PROVIDERS = [{ label: 'Groq', value: 'groq' }]

const LLM_PROVIDERS = [{ label: 'Groq', value: 'groq' }]

export default function SetLLMToken() {
  const { incrementOnboardingStep, decrementOnboardingStep } =
    useOnboardingStore()
  const {
    llm,
    setLlmSettings,
    grammarServiceEnabled,
    macosAccessibilityContextEnabled,
  } = useAdvancedSettingsStore()

  // Local state for immediate feedback, synced with store on change
  const [asrProvider, setAsrProvider] = useState<string>(
    llm.asrProvider || ASR_PROVIDERS[0].value,
  )
  const [asrKey, setAsrKey] = useState<string>(llm.asrApiKey || '')
  const [llmProvider, setLlmProvider] = useState<string>(
    llm.llmProvider || LLM_PROVIDERS[0].value,
  )
  const [llmKey, setLlmKey] = useState<string>(llm.llmApiKey || '')

  // Update store when local state changes
  useEffect(() => {
    setLlmSettings({
      asrProvider,
      asrApiKey: asrKey,
      llmProvider,
      llmApiKey: llmKey,
    })
  }, [asrProvider, asrKey, llmProvider, llmKey, setLlmSettings])

  const containerVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        staggerChildren: 0.1,
        duration: 0.5,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  }

  const handleContinue = async () => {
    try {
      const settingsToSave = {
        llm,
        grammarServiceEnabled,
        macosAccessibilityContextEnabled,
      }
      await window.api.updateAdvancedSettings(settingsToSave)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
    incrementOnboardingStep()
  }

  const isValid = asrKey.length > 0 && llmKey.length > 0

  return (
    <div className="flex flex-row h-full w-full bg-background overflow-hidden">
      {/* Left Content */}
      <div className="flex flex-col w-[55%] h-full overflow-y-auto pl-24 pr-12">
        <div className="flex flex-col min-h-full justify-between py-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="mt-4"
          >
            <button
              className="mb-8 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              type="button"
              onClick={decrementOnboardingStep}
            >
              &lt; Back
            </button>

            <motion.h1
              variants={itemVariants}
              className="text-4xl font-semibold mb-2 tracking-tight"
            >
              Connect your Intelligence.
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-muted-foreground mb-10 text-lg"
            >
              Configure your AI providers to power VibeType's recognition and
              reasoning capabilities.
            </motion.p>

            <div className="flex flex-col gap-8 mb-8">
              {/* ASR Configuration */}
              <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Mic size={18} />
                  </div>
                  <h3 className="font-medium text-lg">Speech Recognition</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 pl-10">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Select Provider
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-left flex items-center justify-between transition-all hover:border-muted-foreground/40">
                          <span>
                            {ASR_PROVIDERS.find(p => p.value === asrProvider)
                              ?.label || 'Select Provider'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover text-popover-foreground border-border"
                        align="start"
                      >
                        {ASR_PROVIDERS.map(p => (
                          <DropdownMenuItem
                            key={p.value}
                            onSelect={() => setAsrProvider(p.value)}
                            className="text-sm cursor-pointer"
                          >
                            {p.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={asrKey}
                        onChange={e => setAsrKey(e.target.value)}
                        placeholder={`Enter your ${ASR_PROVIDERS.find(p => p.value === asrProvider)?.label} API Key`}
                        className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                      />
                      {asrKey.length > 5 && (
                        <div className="absolute right-3 top-2.5 text-green-500">
                          <CheckCircle size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* LLM Configuration */}
              <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <Cpu size={18} />
                  </div>
                  <h3 className="font-medium text-lg">LLM Configuration</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 pl-10">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Select Provider
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-left flex items-center justify-between transition-all hover:border-muted-foreground/40">
                          <span>
                            {LLM_PROVIDERS.find(p => p.value === llmProvider)
                              ?.label || 'Select Provider'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover text-popover-foreground border-border"
                        align="start"
                      >
                        {LLM_PROVIDERS.map(p => (
                          <DropdownMenuItem
                            key={p.value}
                            onSelect={() => setLlmProvider(p.value)}
                            className="text-sm cursor-pointer"
                          >
                            {p.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={llmKey}
                        onChange={e => setLlmKey(e.target.value)}
                        placeholder={`Enter your ${LLM_PROVIDERS.find(p => p.value === llmProvider)?.label} API Key`}
                        className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                      />
                      {llmKey.length > 5 && (
                        <div className="absolute right-3 top-2.5 text-green-500">
                          <CheckCircle size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              variants={itemVariants}
              className="flex flex-col items-start mb-8"
            >
              <Button
                className="px-8 h-11 text-base font-medium w-full max-w-[200px]"
                onClick={handleContinue}
                disabled={!isValid}
              >
                Continue
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Keys are stored securely on your device.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Visual */}
      <div className="flex w-[45%] items-center justify-center bg-muted/30 relative">
        <div className="absolute inset-0 bg-gradient-to-bl from-blue-50/20 via-transparent to-purple-50/20" />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative z-10 flex flex-col items-center gap-6"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-primary/10 rounded-full" />
            <Key
              className="relative z-20 text-foreground/80"
              style={{ width: 180, height: 180 }}
              strokeWidth={1}
            />
          </div>
          <div className="text-center max-w-xs space-y-2 opacity-80">
            <h3 className="text-lg font-medium">Bring your own keys</h3>
            <p className="text-sm text-muted-foreground">
              VibeType connects directly to your AI providers. Your keys remain
              on your device.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
