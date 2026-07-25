import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MelodyLine } from './melodyStore'

export interface LibrarySong {
  id: string
  title: string
  artist: string
  lines: MelodyLine[]
  updatedAt: number
}

interface SongLibraryState {
  songs: LibrarySong[]
  addSong: (song: { title: string; artist: string; lines: MelodyLine[] }) => string
  renameSong: (id: string, fields: { title: string; artist: string }) => void
  deleteSong: (id: string) => void
  updateLines: (id: string, lines: MelodyLine[]) => void
}

export const useSongLibraryStore = create<SongLibraryState>()(
  persist(
    (set) => ({
      songs: [],

      addSong: (song) => {
        const id = crypto.randomUUID()
        set((state) => ({
          songs: [...state.songs, { id, ...song, updatedAt: Date.now() }],
        }))
        return id
      },

      renameSong: (id, fields) =>
        set((state) => ({
          songs: state.songs.map((s) => (s.id === id ? { ...s, ...fields } : s)),
        })),

      deleteSong: (id) =>
        set((state) => ({ songs: state.songs.filter((s) => s.id !== id) })),

      updateLines: (id, lines) =>
        set((state) => ({
          songs: state.songs.map((s) => (s.id === id ? { ...s, lines, updatedAt: Date.now() } : s)),
        })),
    }),
    { name: 'guitar-song-library' },
  ),
)
