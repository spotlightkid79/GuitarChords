import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteName } from '../lib/music-theory'

export interface MelodyNoteItem {
  instanceId: string
  note: NoteName
  stringIndex: number
  fret: number
}

export interface MelodyLine {
  id: string
  name: string
  items: MelodyNoteItem[]
}

interface MelodyState {
  lines: MelodyLine[]
  addLine: () => void
  removeLine: (lineId: string) => void
  renameLine: (lineId: string, name: string) => void
  moveLine: (lineId: string, direction: -1 | 1) => void
  addNote: (lineId: string, note: { note: NoteName; stringIndex: number; fret: number }, atIndex?: number) => void
  removeItem: (lineId: string, instanceId: string) => void
  reorderInLine: (lineId: string, fromIndex: number, toIndex: number) => void
  moveItemToLine: (fromLineId: string, toLineId: string, instanceId: string, toIndex?: number) => void
  clearAll: () => void
}

function newLine(index: number): MelodyLine {
  return { id: crypto.randomUUID(), name: `Line ${index}`, items: [] }
}

export const useMelodyStore = create<MelodyState>()(
  persist(
    (set) => ({
      lines: [newLine(1)],

      addLine: () =>
        set((state) => ({ lines: [...state.lines, newLine(state.lines.length + 1)] })),

      removeLine: (lineId) =>
        set((state) => {
          const lines = state.lines.filter((l) => l.id !== lineId)
          return { lines: lines.length > 0 ? lines : [newLine(1)] }
        }),

      renameLine: (lineId, name) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.id === lineId ? { ...l, name } : l)),
        })),

      moveLine: (lineId, direction) =>
        set((state) => {
          const idx = state.lines.findIndex((l) => l.id === lineId)
          const swapWith = idx + direction
          if (idx === -1 || swapWith < 0 || swapWith >= state.lines.length) return state
          const lines = [...state.lines]
          const tmp = lines[idx]
          lines[idx] = lines[swapWith]
          lines[swapWith] = tmp
          return { lines }
        }),

      addNote: (lineId, note, atIndex) =>
        set((state) => ({
          lines: state.lines.map((l) => {
            if (l.id !== lineId) return l
            const item: MelodyNoteItem = { instanceId: crypto.randomUUID(), ...note }
            const items = [...l.items]
            if (atIndex === undefined || atIndex >= items.length) items.push(item)
            else items.splice(atIndex, 0, item)
            return { ...l, items }
          }),
        })),

      removeItem: (lineId, instanceId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === lineId
              ? { ...l, items: l.items.filter((i) => i.instanceId !== instanceId) }
              : l,
          ),
        })),

      reorderInLine: (lineId, fromIndex, toIndex) =>
        set((state) => ({
          lines: state.lines.map((l) => {
            if (l.id !== lineId) return l
            const items = [...l.items]
            const [moved] = items.splice(fromIndex, 1)
            items.splice(toIndex, 0, moved)
            return { ...l, items }
          }),
        })),

      moveItemToLine: (fromLineId, toLineId, instanceId, toIndex) =>
        set((state) => {
          const fromLine = state.lines.find((l) => l.id === fromLineId)
          const item = fromLine?.items.find((i) => i.instanceId === instanceId)
          if (!item) return state
          return {
            lines: state.lines.map((l) => {
              if (l.id === fromLineId) {
                return { ...l, items: l.items.filter((i) => i.instanceId !== instanceId) }
              }
              if (l.id === toLineId) {
                const items = [...l.items]
                const insertAt = toIndex === undefined ? items.length : toIndex
                items.splice(insertAt, 0, item)
                return { ...l, items }
              }
              return l
            }),
          }
        }),

      clearAll: () => set({ lines: [newLine(1)] }),
    }),
    { name: 'guitar-melody' },
  ),
)
