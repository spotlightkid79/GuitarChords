import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteName } from '../lib/music-theory'
import { DEFAULT_TIME_SIG, type DurationCode, type MelodyEvent, type TimeSig } from '../lib/rhythm'

export type { MelodyEvent } from '../lib/rhythm'

export interface MelodyLine {
  id: string
  name: string
  items: MelodyEvent[]
}

interface MelodyState {
  lines: MelodyLine[]
  inputDuration: DurationCode
  inputDotted: boolean
  setInputDuration: (duration: DurationCode) => void
  toggleInputDotted: () => void
  addLine: () => void
  removeLine: (lineId: string) => void
  renameLine: (lineId: string, name: string) => void
  moveLine: (lineId: string, direction: -1 | 1) => void
  addNote: (
    lineId: string,
    note: { note: NoteName; stringIndex: number; fret: number; duration: DurationCode; dotted: boolean },
    atIndex?: number,
  ) => void
  addRest: (lineId: string, rest: { duration: DurationCode; dotted: boolean }, atIndex?: number) => void
  addTimeSignature: (lineId: string, sig: TimeSig, atIndex?: number) => void
  removeItem: (lineId: string, instanceId: string) => void
  reorderInLine: (lineId: string, fromIndex: number, toIndex: number) => void
  moveItemToLine: (fromLineId: string, toLineId: string, instanceId: string, toIndex?: number) => void
  clearAll: () => void
}

function newLine(index: number): MelodyLine {
  return { id: crypto.randomUUID(), name: `Line ${index}`, items: [] }
}

function insertAt<T>(items: T[], item: T, atIndex?: number): T[] {
  const next = [...items]
  if (atIndex === undefined || atIndex >= next.length) next.push(item)
  else next.splice(atIndex, 0, item)
  return next
}

export const useMelodyStore = create<MelodyState>()(
  persist(
    (set) => ({
      lines: [newLine(1)],
      inputDuration: 'q',
      inputDotted: false,

      setInputDuration: (duration) => set({ inputDuration: duration }),
      toggleInputDotted: () => set((state) => ({ inputDotted: !state.inputDotted })),

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
            const item: MelodyEvent = { instanceId: crypto.randomUUID(), type: 'note', ...note }
            return { ...l, items: insertAt(l.items, item, atIndex) }
          }),
        })),

      addRest: (lineId, rest, atIndex) =>
        set((state) => ({
          lines: state.lines.map((l) => {
            if (l.id !== lineId) return l
            const item: MelodyEvent = { instanceId: crypto.randomUUID(), type: 'rest', ...rest }
            return { ...l, items: insertAt(l.items, item, atIndex) }
          }),
        })),

      addTimeSignature: (lineId, sig, atIndex) =>
        set((state) => ({
          lines: state.lines.map((l) => {
            if (l.id !== lineId) return l
            const item: MelodyEvent = { instanceId: crypto.randomUUID(), type: 'time-signature', ...sig }
            return { ...l, items: insertAt(l.items, item, atIndex) }
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

export function lastTimeSignature(items: MelodyEvent[]): TimeSig {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.type === 'time-signature') return { beats: item.beats, beatValue: item.beatValue }
  }
  return DEFAULT_TIME_SIG
}
