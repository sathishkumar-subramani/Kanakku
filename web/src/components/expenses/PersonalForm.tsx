import { useEffect, useState } from 'react'
import { useCreatePersonalMutation, useUpdatePersonalMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { Category, PersonalExpense } from '@/api/types'
import { useAppSelector } from '@/store'
import { parseAmount } from '@/utils/money'
import { todayKey } from '@/utils/dates'
import { Button } from '@/components/ui/Button'
import { AmountInput, TextArea, TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorNote } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'
import { CategoryPicker } from './ExpenseForm'

interface Props {
  open: boolean
  onClose: () => void
  expense?: PersonalExpense | null
  defaultDate?: string
}

export function PersonalForm({ open, onClose, expense, defaultDate }: Props) {
  const me = useAppSelector((s) => s.auth.user)
  const toast = useToast()
  const [create, createState] = useCreatePersonalMutation()
  const [update, updateState] = useUpdatePersonalMutation()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('food')
  const [date, setDate] = useState(defaultDate ?? todayKey())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setDescription(expense?.description ?? '')
    setAmount(expense ? String(expense.amount) : '')
    setCategory(expense?.category ?? 'food')
    setDate(expense?.date ?? defaultDate ?? todayKey())
    setNotes(expense?.notes ?? '')
  }, [open, expense, defaultDate])

  const amountNum = parseAmount(amount)
  const saving = createState.isLoading || updateState.isLoading
  const canSave = description.trim().length > 0 && amountNum > 0 && !saving

  async function submit() {
    setError('')
    const input = { description: description.trim(), amount: amountNum, category, date, notes: notes.trim() || undefined }
    try {
      if (expense) await update({ id: expense.id, input }).unwrap()
      else await create(input).unwrap()
      toast.success(expense ? 'Expense updated' : 'Expense added')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Edit personal expense' : 'Add personal expense'}
      subtitle="Only you can see this"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave} loading={saving}>
            {expense ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <AmountInput value={amount} onChange={setAmount} currency={me?.currency ?? 'INR'} autoFocus={!expense} />
        <TextField label="What was it for?" placeholder="Coffee, auto, recharge…" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
        <div>
          <span className="field-label">Category</span>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <TextField label="Date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        <TextArea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
    </Modal>
  )
}
