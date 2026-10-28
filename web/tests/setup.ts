import '@testing-library/jest-dom/vitest'
import { install } from './fakeApi'

// jsdom lacks these
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', { value: RO, writable: true })
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
})
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true })
Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:fake', writable: true })
Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true })

install()
