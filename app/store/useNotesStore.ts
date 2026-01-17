import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'
import { v4 as uuidv4 } from 'uuid'
import { Note as NotePb } from '@/app/generated/ito_pb'

export type Note = {
  id: string
  content: string
  user_id: string
  interaction_id: string | null
  created_at: string
  updated_at: string
}

const mapNote = (note: Partial<NotePb> & Record<string, any>): Note => ({
  id: note.id || '',
  content: note.content || '',
  user_id: note.userId || note.user_id || '',
  interaction_id: note.interactionId || note.interaction_id || null,
  created_at: note.createdAt || note.created_at || new Date().toISOString(),
  updated_at: note.updatedAt || note.updated_at || new Date().toISOString(),
})

interface NotesStore {
  notes: Note[]
  isLoading: boolean
  error: string | null
  loadNotes: () => Promise<void>
  addNote: (content: string) => Promise<void>
  updateNote: (id: string, content: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>
}

export const useNotesStore = create<NotesStore>(set => ({
  notes: [],
  isLoading: false,
  error: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null })
    try {
      const notes = await window.api.notes.getAll()
      set({ notes: notes.map(mapNote), isLoading: false })
    } catch (error) {
      console.error('Failed to load notes from server:', error)
      set({ isLoading: false, error: 'Failed to load notes' })
    }
  },

  addNote: async (content: string) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      console.error('Cannot add a note without a logged-in user.')
      return
    }
    set({ isLoading: true, error: null })
    try {
      // Optimistic update could go here, but for now we wait for server
      const newNote = await window.api.notes.add({
        id: uuidv4(),
        content: content.trim(),
        userId: user.id,
      })
      set(state => ({
        notes: [mapNote(newNote), ...state.notes],
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to add note to server:', error)
      set({ isLoading: false, error: 'Failed to add note' })
    }
  },

  updateNote: async (id: string, content: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.notes.updateContent(id, content)
      // Since we just updated, we can likely just update local state instead of reloading
      set(state => ({
        notes: state.notes.map(n =>
          n.id === id
            ? { ...n, content, updated_at: new Date().toISOString() }
            : n,
        ),
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to update note on server:', error)
      set({ isLoading: false, error: 'Failed to update note' })
    }
  },

  deleteNote: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.notes.delete(id)
      set(state => ({
        notes: state.notes.filter(note => note.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to delete note from server:', error)
      set({ isLoading: false, error: 'Failed to delete note' })
    }
  },
}))
