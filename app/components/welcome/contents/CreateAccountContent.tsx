import { Button } from '@/app/components/ui/button'
import { useOnboardingStore } from '@/app/store/useOnboardingStore'
import EmailSignupContent from './EmailSignupContent'
import EmailLoginContent from './EmailLoginContent'
import CheckEmailContent from './CheckEmailContent'
import ItoIcon from '../../icons/ItoIcon'
import GoogleIcon from '../../icons/GoogleIcon'
import GitHubIcon from '../../icons/GitHubIcon'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useDictionaryStore } from '@/app/store/useDictionaryStore'
import { isValidEmail } from '@/app/utils/utils'

export default function CreateAccountContent() {
  const { incrementOnboardingStep, initializeOnboarding } = useOnboardingStore()
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const isDictInitialized = useRef(false)
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [showCheckEmail, setShowCheckEmail] = useState(false)
  const [checkEmailDbUserId, setCheckEmailDbUserId] = useState<string | null>(
    null,
  )
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const {
    user,
    isAuthenticated,
    loginWithGoogle,
    loginWithGitHub,
    signupWithEmail,
  } = useAuth()
  const userName = user?.name

  const addEntry = useDictionaryStore(state => state.addEntry)

  // If user is authenticated, proceed to next step
  useEffect(() => {
    if (isAuthenticated && user) {
      incrementOnboardingStep()
    }
  }, [isAuthenticated, user, incrementOnboardingStep])

  useEffect(() => {
    if (userName && !isDictInitialized.current) {
      addEntry(userName)
      isDictInitialized.current = true
    }
  }, [userName, isDictInitialized, addEntry])

  useEffect(() => {
    initializeOnboarding()
  }, [initializeOnboarding])

  const handleSocialAuth = async (provider: string) => {
    try {
      switch (provider) {
        case 'google':
          await loginWithGoogle()
          break
        /*
        case 'microsoft':
          await loginWithMicrosoft()
          break
        case 'apple':
          await loginWithApple()
          break
        */
        case 'github':
          await loginWithGitHub()
          break
        default:
          console.error('Unknown auth provider:', provider)
      }
    } catch (error) {
      console.error(`${provider} authentication failed:`, error)
    }
  }

  const handleContinueWithEmail = async () => {
    if (!emailOk) {
      setEmailTouched(true)
      return
    }
    try {
      setIsCheckingEmail(true)
      setCheckError(null)
      const res = await window.api.invoke('auth0-check-email', { email })
      if (!res?.success) {
        setCheckError(res?.error || 'Unable to check email')
        return
      }
      if (res.exists) {
        if (res.verified) {
          setShowEmailLogin(true)
        } else {
          setCheckEmailDbUserId(res.dbUserId || null)
          setShowCheckEmail(true)
        }
      } else {
        setShowEmailPassword(true)
      }
    } finally {
      setIsCheckingEmail(false)
    }
  }

  if (showEmailPassword) {
    return (
      <EmailSignupContent
        initialEmail={email}
        onBack={() => setShowEmailPassword(false)}
        onContinue={em => signupWithEmail(em)}
      />
    )
  }

  if (showEmailLogin) {
    return (
      <EmailLoginContent
        initialEmail={email}
        onBack={() => setShowEmailLogin(false)}
        onContinue={() => {}}
      />
    )
  }

  if (showCheckEmail) {
    return (
      <CheckEmailContent
        email={email}
        dbUserId={checkEmailDbUserId}
        onUseAnotherEmail={() => setShowCheckEmail(false)}
        onRequireLogin={() => {
          setShowCheckEmail(false)
          setShowEmailLogin(true)
        }}
        password={null}
      />
    )
  }

  const emailOk = isValidEmail(email)

  return (
    <div className="flex flex-col h-full w-full bg-background items-center justify-center">
      <div className="flex flex-col items-center w-full h-full max-h-full px-8 py-16 mt-12 mb-12">
        {/* Logo */}
        <div className="mb-4 bg-black rounded-md p-2 w-10 h-10">
          <ItoIcon height={24} width={24} style={{ color: '#FFFFFF' }} />
        </div>

        {/* Title and subtitle */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold mb-3 text-foreground">
            Get started with SmartSpeaky
          </h1>
          <p className="text-muted-foreground text-base">
            Smart dictation. Everywhere you want.
          </p>
        </div>

        {/* Social auth buttons */}
        <div className="w-1/2 space-y-3 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full h-12 flex items-center justify-start gap-3 text-sm font-medium"
              onClick={() => handleSocialAuth('google')}
            >
              <GoogleIcon className="size-5" />
              <div className="w-full text-sm font-medium">
                Continue with Google
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-12 flex items-center justify-start gap-2 text-sm font-medium"
              onClick={() => handleSocialAuth('github')}
            >
              <GitHubIcon className="size-5" />
              <div className="w-full text-sm font-medium">
                Continue with GitHub
              </div>
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-1/2 flex items-center my-6">
          <div className="flex-1 border-t border-border"></div>
          <span className="px-4 text-xs text-muted-foreground">OR</span>
          <div className="flex-1 border-t border-border"></div>
        </div>

        {/* Email sign up */}
        <div className="w-1/2 space-y-3 mb-6">
          <input
            type="email"
            placeholder="Email address"
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleContinueWithEmail()
              }
            }}
            aria-invalid={emailTouched && !emailOk}
            aria-describedby={
              emailTouched && !emailOk ? 'signup-email-error' : undefined
            }
            className={`w-full h-12 px-3 rounded-md border bg-background text-foreground placeholder:text-muted-foreground ${
              emailTouched && !emailOk ? 'border-destructive' : 'border-border'
            }`}
          />
          {emailTouched && !emailOk && (
            <p id="signup-email-error" className="text-xs text-destructive">
              Please enter a valid email address
            </p>
          )}
          <Button
            className="w-full h-12 text-sm font-medium"
            disabled={!emailOk || isCheckingEmail}
            aria-busy={isCheckingEmail}
            onClick={handleContinueWithEmail}
          >
            {isCheckingEmail ? 'Checking…' : 'Continue with email'}
          </Button>
          {checkError && (
            <p className="text-xs text-destructive">{checkError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
