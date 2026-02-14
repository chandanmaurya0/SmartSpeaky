import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'
import type { DictionaryItem } from '@/app/generated/ito_pb'

export type DictionaryEntry = {
  id: string
  type: 'normal' | 'replacement'
  createdAt: string
  updatedAt: string
} & (
  | {
      type: 'normal'
      content: string
    }
  | {
      type: 'replacement'
      from: string
      to: string
    }
)

interface DictionaryStore {
  entries: DictionaryEntry[]
  isLoading: boolean
  error: string | null
  loadEntries: () => Promise<void>
  addEntry: (content: string) => Promise<void>
  addReplacement: (from: string, to: string) => Promise<void>
  updateEntry: (
    id: string,
    updates: Partial<Omit<DictionaryEntry, 'id' | 'createdAt' | 'type'>>,
  ) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
}

/**
 * The backend stores a flat DictionaryItem, but the frontend uses a more
 * structured DictionaryEntry. This function maps the backend type to the
 * frontend type.
 * We infer the type based on whether `pronunciation` is null.
 */
const mapItemToEntry = (item: DictionaryItem): DictionaryEntry => {
  if (!item.pronunciation) {
    return {
      id: item.id,
      type: 'normal',
      content: item.word,
      createdAt: item.createdAt?.toString() || new Date().toISOString(), // PB timestamp to string
      updatedAt: item.updatedAt?.toString() || new Date().toISOString(),
    }
  } else {
    return {
      id: item.id,
      type: 'replacement',
      from: item.word,
      to: item.pronunciation,
      createdAt: item.createdAt?.toString() || new Date().toISOString(),
      updatedAt: item.updatedAt?.toString() || new Date().toISOString(),
    }
  }
}

export const useDictionaryStore = create<DictionaryStore>((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,

  loadEntries: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await window.api.dictionary.getAll()
      const entries = items.map(mapItemToEntry)
      set({ entries, isLoading: false })
    } catch (error) {
      console.error('Failed to load dictionary from server:', error)
      set({ isLoading: false, error: 'Failed to load dictionary' })
    }
  },

  addEntry: async (content: string) => {
    const { user } = useAuthStore.getState()
    if (!user) return
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.dictionary.add({
        user_id: user.id,
        word: content.trim(),
        pronunciation: null,
      })
      if (!result) throw new Error('Failed to add entry') // gRPC might throw, but handle null just in case
      // IPC wrapper returns the item directly or throws, update if signature changed in IPC

      // Note: In IPC refactor we made it return the result directly.
      // If result is the object:
      const newEntry = mapItemToEntry(result as any)
      set(state => ({
        entries: [newEntry, ...state.entries],
        isLoading: false,
      }))
    } catch (error: any) {
      console.error('Failed to add dictionary entry:', error)
      set({ isLoading: false, error: error.message || 'Failed to add entry' })
    }
  },

  addReplacement: async (from: string, to: string) => {
    const { user } = useAuthStore.getState()
    if (!user) return
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.dictionary.add({
        user_id: user.id,
        word: from.trim(),
        pronunciation: to.trim(),
      })
      const newEntry = mapItemToEntry(result as any)
      set(state => ({
        entries: [newEntry, ...state.entries],
        isLoading: false,
      }))
    } catch (error: any) {
      console.error('Failed to add replacement:', error)
      set({
        isLoading: false,
        error: error.message || 'Failed to add replacement',
      })
    }
  },

  updateEntry: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const originalEntry = get().entries.find(e => e.id === id)
      if (!originalEntry) {
        set({ isLoading: false })
        return
      }

      // Create a new entry object with the updates applied
      const updatedEntry = { ...originalEntry, ...updates }

      let word: string
      let pronunciation: string | null

      if (updatedEntry.type === 'normal') {
        word = updatedEntry.content
        pronunciation = null
      } else {
        word = updatedEntry.from
        pronunciation = updatedEntry.to
      }

      await window.api.dictionary.update(id, word, pronunciation)

      // Reload or update local state
      // get().loadEntries()
      // Optimization: Update local state directly
      set(state => ({
        entries: state.entries.map(e =>
          e.id === id
            ? ({
                ...e,
                ...updates,
                updatedAt: new Date().toISOString(),
              } as DictionaryEntry)
            : e,
        ),
        isLoading: false,
      }))
    } catch (error: any) {
      console.error('Failed to update dictionary entry:', error)
      set({
        isLoading: false,
        error: error.message || 'Failed to update entry',
      })
    }
  },

  deleteEntry: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.dictionary.delete(id)
      set(state => ({
        entries: state.entries.filter(e => e.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to delete dictionary entry:', error)
      set({ isLoading: false, error: 'Failed to delete dictionary entry' })
    }
  },
}))
