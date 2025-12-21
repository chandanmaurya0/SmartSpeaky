import { useCallback, useEffect, useMemo } from 'react'
import { create } from 'zustand'

export enum ProStatus {
  ACTIVE_PRO = 'active_pro',
  NONE = 'none',
}

export type BillingState = {
  proStatus: ProStatus
  subscriptionStartAt: Date | null
  subscriptionEndAt: Date | null
  isScheduledForCancellation: boolean
}

// Shared state store - all useBillingState instances share this
const useBillingStateStore = create<{
  state: BillingState | null
  isLoading: boolean
  error: string | null
  setState: (s: BillingState | null) => void
  setLoading: (l: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}>(set => ({
  state: null,
  isLoading: true,
  error: null,
  setState: state => set({ state }),
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),
  reset: () => set({ state: null, isLoading: true, error: null }),
}))

// Export reset function for testing
export const resetBillingState = () => useBillingStateStore.getState().reset()

export function useBillingState() {
  const { state, isLoading, error, setState, setLoading, setError } =
    useBillingStateStore()

  useEffect(() => {
    try {
      const authStore = window.electron?.store?.get('auth') || {}
      const cached: (BillingState & { fetchedAt?: string }) | undefined =
        authStore?.billing
      if (cached) {
        setState({
          ...cached,
          subscriptionStartAt: cached.subscriptionStartAt
            ? new Date(cached.subscriptionStartAt)
            : null,
          subscriptionEndAt: cached.subscriptionEndAt
            ? new Date(cached.subscriptionEndAt)
            : null,
        })
      }
    } catch {
      console.warn('Failed to load billing state from cache')
    } finally {
      setLoading(false)
    }
  }, [setState, setLoading])

  const cacheState = useCallback((s: BillingState) => {
    try {
      const withFetchedAt = { ...s, fetchedAt: new Date().toISOString() }
      window.api.send('electron-store-set', 'auth.billing', withFetchedAt)
    } catch {
      console.warn('Failed to cache billing state')
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.billing.status()
      if (!res?.success) {
        setError(res?.error || 'Failed to load billing status')
      } else {
        const subStart = res?.subscriptionStartAt
          ? new Date(res.subscriptionStartAt)
          : null
        const subEnd = res?.subscriptionEndAt
          ? new Date(res.subscriptionEndAt)
          : null
        const next: BillingState = {
          proStatus: res.pro_status,
          subscriptionStartAt: subStart,
          subscriptionEndAt: subEnd,
          isScheduledForCancellation: !!res?.isScheduledForCancellation,
        }
        setState(next)
        cacheState(next)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load billing status')
    } finally {
      setLoading(false)
    }
  }, [cacheState, setState, setLoading, setError])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Periodically refresh billing state to stay in sync with webhook updates
  useEffect(() => {
    const interval = setInterval(
      () => {
        refresh()
      },
      2 * 60 * 1000,
    ) // Refresh every 2 minutes

    return () => clearInterval(interval)
  }, [refresh])

  // Refresh billing state when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      refresh()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [refresh])

  const api = useMemo(
    () => ({
      isLoading,
      error,
      proStatus: state?.proStatus ?? ProStatus.NONE,
      isPro: (state?.proStatus ?? ProStatus.NONE) === ProStatus.ACTIVE_PRO,
      hasSubscription:
        (state?.proStatus ?? ProStatus.NONE) === ProStatus.ACTIVE_PRO,
      subscriptionStartAt: state?.subscriptionStartAt ?? null,
      subscriptionEndAt: state?.subscriptionEndAt ?? null,
      isScheduledForCancellation: state?.isScheduledForCancellation ?? false,
      refresh,
    }),
    [isLoading, error, state, refresh],
  )

  return api
}

export default useBillingState
