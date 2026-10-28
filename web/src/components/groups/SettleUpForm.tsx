import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useCreateSettlementMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { Group } from '@/api/types'
import { useAppSelector } from '@/store'
import { parseAmount } from '@/utils/money'
import { todayKey } from '@/utils/dates'
import { Button } from '@/components/ui/Button'
import { AmountInput, SelectField, TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorNote } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'

interface Props {
  open: boolean
  onClose: () => void
  group: Group
  /** Prefill from a "who pays whom" row. */
  preset?: { fromUserId: string; toUserId: string; amount: number } | null
}

export function SettleUpForm({ open, onClose, group, preset }: Props) {
  const me = useAppSelector((s) => s.auth.user)
  const toast = useToast()
  const [create, state] = useCreateSettlementMutation()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const membersKey = group.members.map((m) => m.userId).join(',')

  useEffect(() => {
    if (!open) return
    setError('')
    const others = group.members.filter((m) => m.userId !== me?.id)
    setFrom(preset?.fromUserId ?? me?.id ?? '')
    setTo(preset?.toUserId ?? others[0]?.userId ?? '')
    setAmount(preset ? String(preset.amount) : '')
    setDate(todayKey())
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, group.id, membersKey, me?.id])

  const amountNum = parseAmount(amount)
  const canSave = from && to && from !== to && amountNum > 0 && !state.isLoading
  const label = (id: string) => (id === me?.id ? 'You' : group.members.find((m) => m.userId === id)?.name ?? '?')

  async function submit() {
    setError('')
    try {
      await create({ groupId: group.id, input: { fromUserId: from, toUserId: to, amount: amountNum, date, note: note.trim() || undefined } }).unwrap()
      toast.success(`${label(from)} paid ${label(to)} — recorded`)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      subtitle="Settling up doesn't move money — it just notes that a payment happened."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave} loading={state.isLoading}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <SelectField label="Who paid" value={from} onChange={(e) => setFrom(e.target.value)}>
            {group.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {label(m.userId)}
              </option>
            ))}
          </SelectField>
          <button type="button" onClick={() => { setFrom(to); setTo(from) }} className="h-10 w-10 mb-px rounded-full bg-surface2 flex items-center justify-center text-muted hover:text-ink" aria-label="Swap">
            <ArrowLeftRight size={16} />
          </button>
          <SelectField label="To" value={to} onChange={(e) => setTo(e.target.value)}>
            {group.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {label(m.userId)}
              </option>
            ))}
          </SelectField>
        </div>
        {from === to && <p className="text-[12px] text-negative">Payer and receiver must be different people.</p>}
        <AmountInput value={amount} onChange={setAmount} currency={group.currency} />
        <TextField label="Date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Note (optional)" placeholder="GPay, cash…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>
    </Modal>
  )
}
