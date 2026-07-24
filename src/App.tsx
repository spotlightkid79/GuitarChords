import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import NavBar, { type Tab } from './components/NavBar'
import ChordLibrary from './components/ChordLibrary'
import ScaleLibrary from './components/ScaleLibrary'
import ProgressionBoard, { BOARD_DROPPABLE_ID } from './components/ProgressionBoard'
import { useProgressionStore } from './store/progressionStore'

export default function App() {
  const [tab, setTab] = useState<Tab>('chords')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const { items, addChord, reorder } = useProgressionStore.getState()

    if (activeId.startsWith('lib:')) {
      const chordId = active.data.current?.chordId as string | undefined
      if (!chordId) return
      if (overId === BOARD_DROPPABLE_ID) {
        addChord(chordId)
      } else {
        const idx = items.findIndex((i) => i.instanceId === overId)
        addChord(chordId, idx === -1 ? undefined : idx)
      }
      return
    }

    const fromIndex = items.findIndex((i) => i.instanceId === activeId)
    const toIndex = items.findIndex((i) => i.instanceId === overId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    reorder(fromIndex, toIndex)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col">
        <NavBar active={tab} onChange={setTab} />
        <main className="flex-1 overflow-y-auto p-4">
          {tab === 'chords' ? <ChordLibrary /> : <ScaleLibrary />}
        </main>
        <ProgressionBoard />
      </div>
    </DndContext>
  )
}
