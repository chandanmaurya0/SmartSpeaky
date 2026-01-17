import { Button } from '@/app/components/ui/button'
import { UserCircle, FileText, Trash, ShieldCheck } from '@mynaui/icons-react'
import { EXTERNAL_LINKS } from '@/lib/constants/external-links'
import { useOnboardingStore } from '@/app/store/useOnboardingStore'
import { useSettingsStore } from '@/app/store/useSettingsStore'
import { motion } from 'framer-motion'

export default function DataControlContent() {
  const { incrementOnboardingStep, decrementOnboardingStep } =
    useOnboardingStore()
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
              onClick={decrementOnboardingStep}
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
              className="text-muted-foreground mb-10 text-lg"
            >
              We prioritize your privacy and transparency in how we handle your
              information.
            </motion.p>

            <div className="flex flex-col gap-6 mb-10">
              <motion.div variants={itemVariants} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <UserCircle size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">
                    Account Management
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We store your name and email purely for account management.
                    Your personal details are never shared with third parties.
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">
                    Interactions & Notes
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    All your interactions and notes are securely stored to
                    ensure your data is available across your devices.
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <Trash size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">Full Ownership</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You have full control to delete your data or account at any
                    time. Once deleted, all data is permanently removed from our
                    systems.
                  </p>
                </div>
              </motion.div>
            </div>

            <motion.div variants={itemVariants} className="flex flex-col gap-3">
              <div
                className={`group flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  shareAnalytics
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 bg-background'
                }`}
                onClick={() => setShareAnalytics(true)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">
                    Help improve VibeType
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
                className={`group flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
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
              className="mt-6 text-xs text-muted-foreground"
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
