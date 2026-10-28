import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import clsx from 'clsx'

type Tone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  tone: Tone
  text: string
}

interface ToastApi {
  toast: (text: string, tone?: Tone) => void
  success: (text: string) => void
  error: (text: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const toast = useCallback((text: string, tone: Tone = 'info') => {
    const id = ++counter.current
    setItems((list) => [...list, { id, tone, text }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 5000 : 3200)
  }, [])

  const api = useMemo<ToastApi>(() => ({ toast, success: (t) => toast(t, 'success'), error: (t) => toast(t, 'error') }), [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-md">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'rise pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface shadow-pop px-4 py-2.5 text-[13px] font-medium',
              t.tone === 'error' && 'text-negative',
              t.tone === 'success' && 'text-positive',
            )}
          >
            {t.tone === 'success' ? <CheckCircle2 size={16} /> : t.tone === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
            <span className="text-ink">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
