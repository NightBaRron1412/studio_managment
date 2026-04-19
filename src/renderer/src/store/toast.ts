import { create } from 'zustand'

type ToastKind = 'success' | 'error' | 'info'
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastStore {
  items: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  remove: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastStore>((set) => ({
  items: [],
  push: (kind, message) => {
    const id = nextId++
    set((s) => ({ items: [...s.items, { id, kind, message }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 2600)
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
}))

export const toast = {
  success: (msg: string) => useToast.getState().push('success', msg),
  error: (msg: string) => useToast.getState().push('error', msg),
  info: (msg: string) => useToast.getState().push('info', msg)
}
