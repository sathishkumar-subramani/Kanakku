import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full bg-surface border border-border shadow-pop rise flex flex-col max-h-[92vh] sm:max-h-[88vh]',
          'rounded-t-card sm:rounded-card',
          sizes[size],
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="flex-1 min-w-0">
              {title && <h2 className="text-[18px] font-bold leading-tight">{title}</h2>}
              {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full text-muted hover:bg-surface2 hover:text-ink transition" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-[14px] text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 px-4 rounded-field bg-surface2 text-[14px] font-semibold hover:brightness-95 transition">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={clsx(
            'h-10 px-4 rounded-field text-[14px] font-semibold transition disabled:opacity-50',
            danger ? 'bg-negative text-white hover:brightness-110' : 'bg-accent text-on-accent hover:brightness-110',
          )}
        >
          {loading ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
