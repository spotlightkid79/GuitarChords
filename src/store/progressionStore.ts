import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BoardItem {
  instanceId: string
  chordId: string
}

interface ProgressionState {
  items: BoardItem[]
  addChord: (chordId: string, atIndex?: number) => void
  removeItem: (instanceId: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
  clear: () => void
}

export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set) => ({
      items: [],
      addChord: (chordId, atIndex) =>
        set((state) => {
          const item: BoardItem = { instanceId: crypto.randomUUID(), chordId }
          const items = [...state.items]
          if (atIndex === undefined || atIndex >= items.length) {
            items.push(item)
          } else {
            items.splice(atIndex, 0, item)
          }
          return { items }
        }),
      removeItem: (instanceId) =>
        set((state) => ({ items: state.items.filter((i) => i.instanceId !== instanceId) })),
      reorder: (fromIndex, toIndex) =>
        set((state) => {
          const items = [...state.items]
          const [moved] = items.splice(fromIndex, 1)
          items.splice(toIndex, 0, moved)
          return { items }
        }),
      clear: () => set({ items: [] }),
    }),
    { name: 'guitar-progression' },
  ),
)
