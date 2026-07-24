import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BoardLine } from './progressionStore'

export interface SavedSong {
  id: string
  name: string
  lines: BoardLine[]
  updatedAt: number
}

interface SongsState {
  songs: SavedSong[]
  activeSongId: string | null
  saveAsNew: (name: string, lines: BoardLine[]) => string
  updateExisting: (id: string, lines: BoardLine[]) => void
  renameSong: (id: string, name: string) => void
  deleteSong: (id: string) => void
  setActive: (id: string | null) => void
}

export const useSongsStore = create<SongsState>()(
  persist(
    (set) => ({
      songs: [],
      activeSongId: null,

      saveAsNew: (name, lines) => {
        const id = crypto.randomUUID()
        set((state) => ({
          songs: [...state.songs, { id, name, lines, updatedAt: Date.now() }],
          activeSongId: id,
        }))
        return id
      },

      updateExisting: (id, lines) =>
        set((state) => ({
          songs: state.songs.map((s) => (s.id === id ? { ...s, lines, updatedAt: Date.now() } : s)),
        })),

      renameSong: (id, name) =>
        set((state) => ({ songs: state.songs.map((s) => (s.id === id ? { ...s, name } : s)) })),

      deleteSong: (id) =>
        set((state) => ({
          songs: state.songs.filter((s) => s.id !== id),
          activeSongId: state.activeSongId === id ? null : state.activeSongId,
        })),

      setActive: (id) => set({ activeSongId: id }),
    }),
    { name: 'guitar-songs' },
  ),
)
