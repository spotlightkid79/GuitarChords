import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MelodyLine } from './melodyStore'

export interface SavedMelody {
  id: string
  name: string
  lines: MelodyLine[]
  updatedAt: number
}

interface MelodiesState {
  melodies: SavedMelody[]
  activeMelodyId: string | null
  saveAsNew: (name: string, lines: MelodyLine[]) => string
  updateExisting: (id: string, lines: MelodyLine[]) => void
  renameMelody: (id: string, name: string) => void
  deleteMelody: (id: string) => void
  setActive: (id: string | null) => void
}

export const useMelodiesStore = create<MelodiesState>()(
  persist(
    (set) => ({
      melodies: [],
      activeMelodyId: null,

      saveAsNew: (name, lines) => {
        const id = crypto.randomUUID()
        set((state) => ({
          melodies: [...state.melodies, { id, name, lines, updatedAt: Date.now() }],
          activeMelodyId: id,
        }))
        return id
      },

      updateExisting: (id, lines) =>
        set((state) => ({
          melodies: state.melodies.map((m) => (m.id === id ? { ...m, lines, updatedAt: Date.now() } : m)),
        })),

      renameMelody: (id, name) =>
        set((state) => ({ melodies: state.melodies.map((m) => (m.id === id ? { ...m, name } : m)) })),

      deleteMelody: (id) =>
        set((state) => ({
          melodies: state.melodies.filter((m) => m.id !== id),
          activeMelodyId: state.activeMelodyId === id ? null : state.activeMelodyId,
        })),

      setActive: (id) => set({ activeMelodyId: id }),
    }),
    { name: 'guitar-melodies' },
  ),
)
