import { Button } from '@/app/components/ui/button'

import { EXTERNAL_LINKS } from '@/lib/constants/external-links'
import { useOnboardingStore } from '@/app/store/useOnboardingStore'
import { useSettingsStore } from '@/app/store/useSettingsStore'
import { useAuthStore } from '@/app/store/useAuthStore'
import { motion } from 'framer-motion'
import { Trash, ShieldCheck } from '@mynaui/icons-react'

export default function DataControlContent() {
  const { incrementOnboardingStep, decrementOnboardingStep, onboardingStep } =
    useOnboardingStore()
  const { clearAuth } = useAuthStore()
  const { shareAnalytics, setShareAnalytics } = useSettingsStore()

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

  return (
    <div className="flex flex-row h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col w-[50%] h-full overflow-y-auto pl-24 pr-12">
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
              onClick={() => {
                if (onboardingStep === 1) {
                  clearAuth(true)
                }
                decrementOnboardingStep()
              }}
            >
              &lt; Back
            </button>

            <motion.h1
              variants={itemVariants}
              className="text-4xl font-semibold mb-2 tracking-tight"
            >
              Your data, your control.
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-muted-foreground mb-8 text-lg"
            >
              Transparent and secure data handling.
            </motion.p>

            <div className="flex flex-col gap-5 mb-8">
              <motion.div variants={itemVariants} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-medium text-base mb-0.5">
                    Privacy by Design
                  </h3>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Encrypted sync for notes and settings. Your information is
                    never shared or sold to third parties.
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <Trash size={22} />
                </div>
                <div>
                  <h3 className="font-medium text-base mb-0.5">
                    Instant Deletion
                  </h3>
                  <p className="text-sm text-muted-foreground leading-snug">
                    One-click account and data removal. All records are
                    permanently purged from our systems immediately.
                  </p>
                </div>
              </motion.div>
            </div>

            <motion.div variants={itemVariants} className="flex flex-col gap-3">
              <div
                className={`group flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  shareAnalytics
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 bg-background'
                }`}
                onClick={() => setShareAnalytics(true)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">
                    Help improve SmartSpeaky
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Share anonymous usage data to help us build better models.
                  </span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    shareAnalytics
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {shareAnalytics && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>

              <div
                className={`group flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  !shareAnalytics
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 bg-background'
                }`}
                onClick={() => setShareAnalytics(false)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">Privacy Mode</span>
                  <span className="text-xs text-muted-foreground">
                    No dictation data will be stored or used for model training.
                  </span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    !shareAnalytics
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {!shareAnalytics && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mt-4 text-xs text-muted-foreground"
            >
              You can change these preferences anytime in settings.{' '}
              <button
                onClick={() =>
                  window.api?.invoke(
                    'web-open-url',
                    EXTERNAL_LINKS.PRIVACY_POLICY,
                  )
                }
                className="underline hover:text-primary transition-colors cursor-pointer"
              >
                Read our Privacy Policy.
              </button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col items-start mb-8"
          >
            <Button
              className="px-8 h-11 text-base font-medium"
              onClick={incrementOnboardingStep}
            >
              Continue
            </Button>
          </motion.div>
        </div>
      </div>
      <div className="flex w-[50%] items-center justify-center bg-muted/30 relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/10" />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative z-10"
        >
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full" />
            <ShieldCheck
              className="relative z-20 text-primary/60"
              style={{ width: 200, height: 200 }}
              strokeWidth={1}
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
