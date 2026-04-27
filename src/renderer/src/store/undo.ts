// Session-only undo stack. Entries are pushed by mutation onSuccess
// handlers across the app and popped (LIFO) by the global Ctrl+Z handler
// in Layout. Each entry is a self-contained closure that knows how to
// reverse exactly one mutation — keeping the inverse logic colocated
// with the mutation that produced it (instead of a giant switch
// elsewhere) keeps the undo system loosely coupled and avoids
// schema/audit-log churn.
//
// Limit defends against memory growth on a long-running session and
// keeps Ctrl+Z behavior predictable: only the last 50 actions are
// undoable.
import { create } from 'zustand'

export interface UndoEntry {
  // Short, human-readable description of what would be reversed.
  // Shown in the toast after Ctrl+Z fires (e.g., "تم التراجع عن: حذف المعاملة").
  description: string
  // Async because most undos call IPC; throws are surfaced to the user
  // via toast so the stack stays consistent if an undo fails.
  undo: () => Promise<void>
}

interface UndoState {
  stack: UndoEntry[]
  push: (entry: UndoEntry) => void
  pop: () => UndoEntry | null
  clear: () => void
}

const MAX_STACK = 50

export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  push: (entry) =>
    set((s) => {
      const next = [...s.stack, entry]
      if (next.length > MAX_STACK) next.shift()
      return { stack: next }
    }),
  pop: () => {
    const s = get().stack
    if (s.length === 0) return null
    const entry = s[s.length - 1]
    set({ stack: s.slice(0, -1) })
    return entry
  },
  clear: () => set({ stack: [] })
}))

// Convenience wrapper used by mutation handlers — saves the boilerplate
// of importing the hook function and calling getState() when you just
// want to push an entry from inside an onSuccess callback.
export function pushUndo(entry: UndoEntry): void {
  useUndoStore.getState().push(entry)
}
