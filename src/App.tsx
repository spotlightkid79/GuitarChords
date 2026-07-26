import { lazy, Suspense, useEffect, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import NavBar, { type Tab } from './components/NavBar'
import ChordLibrary from './components/ChordLibrary'
import ScaleLibrary from './components/ScaleLibrary'
import NotesExplorer from './components/NotesExplorer'
import SongsLibrary from './components/SongsLibrary'
import ChordSheet from './components/ChordSheet'
import ProgressionBoard from './components/ProgressionBoard'
import { useProgressionStore, type BoardLine } from './store/progressionStore'
import { useMelodyStore, type MelodyLine } from './store/melodyStore'
import { useThemeStore } from './store/themeStore'
import type { NoteName } from './lib/music-theory'

// MelodyBoard pulls in vexflow (a large music-notation library) only needed on the Notes tab.
const MelodyBoard = lazy(() => import('./components/MelodyBoard'))
// MelodyLibrary additionally pulls in the Guitar Pro importer (alphaTab) only when the user imports a file.
const MelodyLibrary = lazy(() => import('./components/MelodyLibrary'))

function locateItem(lines: BoardLine[], instanceId: string) {
  for (const line of lines) {
    const index = line.items.findIndex((i) => i.instanceId === instanceId)
    if (index !== -1) return { lineId: line.id, index }
  }
  return null
}

function resolveDropTarget(lines: BoardLine[], overId: string) {
  if (overId.startsWith('line:')) {
    const lineId = overId.slice('line:'.length)
    const line = lines.find((l) => l.id === lineId)
    return line ? { lineId, index: line.items.length } : null
  }
  return locateItem(lines, overId)
}

function locateMelodyItem(lines: MelodyLine[], instanceId: string) {
  for (const line of lines) {
    const index = line.items.findIndex((i) => i.instanceId === instanceId)
    if (index !== -1) return { lineId: line.id, index }
  }
  return null
}

function resolveMelodyDropTarget(lines: MelodyLine[], overId: string) {
  if (overId.startsWith('melody-line:')) {
    const lineId = overId.slice('melody-line:'.length)
    const line = lines.find((l) => l.id === lineId)
    return line ? { lineId, index: line.items.length } : null
  }
  return locateMelodyItem(lines, overId)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('chords')
  const theme = useThemeStore((s) => s.theme)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  function handleChordDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const { lines, addChord, reorderInLine, moveItemToLine } = useProgressionStore.getState()

    const target = resolveDropTarget(lines, overId)
    if (!target) return

    if (activeId.startsWith('lib:')) {
      const chordId = active.data.current?.chordId as string | undefined
      if (!chordId) return
      addChord(target.lineId, chordId, target.index)
      return
    }

    const source = locateItem(lines, activeId)
    if (!source) return

    if (source.lineId === target.lineId) {
      if (source.index === target.index) return
      reorderInLine(source.lineId, source.index, target.index)
    } else {
      moveItemToLine(source.lineId, target.lineId, activeId, target.index)
    }
  }

  function handleMelodyDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const { lines, addNote, reorderInLine, moveItemToLine, inputDuration, inputDotted } = useMelodyStore.getState()

    const target = resolveMelodyDropTarget(lines, overId)
    if (!target) return

    if (activeId.startsWith('note:')) {
      const data = active.data.current as { note: NoteName; stringIndex: number; fret: number } | undefined
      if (!data) return
      addNote(
        target.lineId,
        { note: data.note, stringIndex: data.stringIndex, fret: data.fret, duration: inputDuration, dotted: inputDotted },
        target.index,
      )
      return
    }

    const source = locateMelodyItem(lines, activeId)
    if (!source) return

    if (source.lineId === target.lineId) {
      if (source.index === target.index) return
      reorderInLine(source.lineId, source.index, target.index)
    } else {
      moveItemToLine(source.lineId, target.lineId, activeId, target.index)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (tab === 'notes') {
      handleMelodyDragEnd(event)
    } else {
      handleChordDragEnd(event)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col">
        <NavBar active={tab} onChange={setTab} />
        <main className="flex-1 overflow-y-auto p-4">
          {tab === 'chords' && <ChordLibrary />}
          {tab === 'scales' && <ScaleLibrary />}
          {tab === 'notes' && <NotesExplorer />}
          {tab === 'songs' && <SongsLibrary />}
          {tab === 'lyrics' && <ChordSheet onSendToChords={() => setTab('chords')} />}
          {tab === 'library' && (
            <Suspense fallback={null}>
              <MelodyLibrary
                onEditInNotes={(lines) => {
                  useMelodyStore.getState().setLines(lines)
                  setTab('notes')
                }}
              />
            </Suspense>
          )}
        </main>
        {tab === 'chords' && <ProgressionBoard />}
        {tab === 'notes' && (
          <Suspense fallback={<div className="h-24 border-t border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-[#14151b]" />}>
            <MelodyBoard />
          </Suspense>
        )}
      </div>
    </DndContext>
  )
}
