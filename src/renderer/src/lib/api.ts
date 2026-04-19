import type { API } from '@shared/types'

declare global {
  interface Window {
    api: API
  }
}

export const api: API = window.api
