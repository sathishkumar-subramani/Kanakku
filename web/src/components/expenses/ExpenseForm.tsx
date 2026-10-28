import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useCreateExpenseMutation, useUpdateExpenseMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { Category, Expense, ExpenseInput, Group, SplitType } from '@/api/types'
import { useAppSelector } from '@/store'
import { CATEGORIES, CATEGORY_KEYS } from '@/theme/tokens'
import { money, parseAmount } from '@/utils/money'
import { previewSplit, type SplitRow } from '@/utils/split'
import { todayKey } from '@/utils/dates'
import { Button } from '@/components/ui/Button'
import { AmountInput, SelectField, TextArea, TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Avatar, ErrorNote, Segmented } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'

interface Props {
  open: boolean
  onClose: () => void
  group: Group
  expense?: Expense | null
  defaultDate?: string
  onSaved?: (e: Expense) => void
}

export function CategoryPicker({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_KEYS.map((key) => {
        const meta = CATEGORIES[key]
        const active = value === key
        return (
          <button key={key} type="button" onClick={() => onChange(key)} className={clsx('chip', active && 'chip-active')} style={active ? { borderColor: meta.color } : undefined}>
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ExpenseForm({ open, onClose, group, expense, defaultDate, onSaved }: Props) {
  const me = useAppSelector((s) => s.auth.user)
  const toast = useToast()
  const [createExpense, createState] = useCreateExpenseMutation()
  const [updateExpense, updateState] = useUpdateExpenseMutation()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('food')
  const [date, setDate] = useState(defaultDate ?? todayKey())
  const [paidBy, setPaidBy] = useState(me?.id ?? '')
  const [advanced, setAdvanced] = useState(false)
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [rows, setRows] = useState<SplitRow[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  // Re-initialise only when the sheet opens or the member list really changes — not on every background refetch.
  const membersKey = group.members.map((m) => m.userId).join(',')

  useEffect(() => {
    if (!open) return
    setError('')
    if (expense) {
      setDescription(expense.description)
      setAmount(String(expense.amount))
      setCategory(expense.category)
      setDate(expense.date)
      setPaidBy(expense.paidBy.id)
      setSplitType(expense.splitType)
      setAdvanced(expense.splitType !== 'equal')
      setNotes(expense.notes ?? '')
      setRows(
        group.members.map((m) => {
          const s = expense.splits.find((x) => x.userId === m.userId)
          return { userId: m.userId, included: !!s, value: s ? (expense.splitType === 'exact' ? s.amount : s.value) : expense.splitType === 'shares' ? 1 : 0 }
        }),
      )
    } else {
      setDescription('')
      setAmount('')
      setCategory('food')
      setDate(defaultDate ?? todayKey())
      setPaidBy(me?.id ?? group.members[0]?.userId ?? '')
      setSplitType('equal')
      setAdvanced(false)
      setNotes('')
      setRows(group.members.map((m) => ({ userId: m.userId, included: true, value: 1 })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense, group.id, membersKey, defaultDate, me?.id])

  const amountNum = parseAmount(amount)
  const preview = useMemo(() => previewSplit(amountNum, splitType, rows, paidBy), [amountNum, splitType, rows, paidBy])
  const includedCount = rows.filter((r) => r.included).length

  const memberOf = (id: string) => group.members.find((m) => m.userId === id)

  function toggleRow(userId: string) {
    setRows((rs) => rs.map((r) => (r.userId === userId ? { ...r, included: !r.included } : r)))
  }
  function setRowValue(userId: string, raw: string) {
    const v = Number(raw)
    setRows((rs) => rs.map((r) => (r.userId === userId ? { ...r, value: Number.isFinite(v) ? v : 0 } : r)))
  }
  function changeSplitType(t: SplitType) {
    setSplitType(t)
    // sensible defaults when switching
    setRows((rs) => {
      const inc = rs.filter((r) => r.included)
      return rs.map((r) => {
        if (!r.included) return r
        if (t === 'shares') return { ...r, value: 1 }
        if (t === 'percent') return { ...r, value: inc.length ? Math.round((100 / inc.length) * 100) / 100 : 0 }
        if (t === 'exact') return { ...r, value: inc.length ? Math.round((amountNum / inc.length) * 100) / 100 : 0 }
        return { ...r, value: 1 }
      })
    })
  }

  const saving = createState.isLoading || updateState.isLoading
  const canSave = description.trim().length > 0 && amountNum > 0 && preview.valid && !!paidBy && !saving

  async function submit() {
    setError('')
    if (!description.trim()) return setError('Give the expense a short description.')
    if (!(amountNum > 0)) return setError('Enter an amount greater than 0.')
    if (!preview.valid) return setError(preview.message)

    const input: ExpenseInput = {
      description: description.trim(),
      amount: amountNum,
      category,
      date,
      notes: notes.trim() || undefined,
      paidBy,
      splitType,
      splits: rows.filter((r) => r.included).map((r) => ({ userId: r.userId, value: splitType === 'equal' ? 0 : r.value })),
    }
    try {
      const saved = expense
        ? await updateExpense({ id: expense.id, groupId: group.id, input }).unwrap()
        : await createExpense({ groupId: group.id, input }).unwrap()
      toast.success(expense ? 'Expense updated' : 'Expense added')
      onSaved?.(saved)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Edit expense' : 'Add expense'}
      subtitle={`${group.emoji} ${group.name}`}
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

        <AmountInput value={amount} onChange={setAmount} currency={group.currency} autoFocus={!expense} />

        <TextField label="What was it for?" placeholder="Dinner, groceries, rent…" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />

        <div>
          <span className="field-label">Category</span>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
          <SelectField label="Paid by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {group.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === me?.id ? 'You' : m.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="rounded-card border border-border p-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[14px] font-semibold">Split between</p>
              <p className="text-[12px] text-muted">
                {splitType === 'equal' && includedCount > 0 && amountNum > 0 ? `${money(amountNum / includedCount, group.currency)} each · ${includedCount} ${includedCount === 1 ? 'person' : 'people'}` : `${includedCount} selected`}
              </p>
            </div>
            <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-[var(--accent)] w-4 h-4"
                checked={advanced}
                onChange={(e) => {
                  setAdvanced(e.target.checked)
                  changeSplitType(e.target.checked ? 'exact' : 'equal')
                }}
              />
              Advanced split
            </label>
          </div>

          {advanced && (
            <div className="mt-3">
              <Segmented
                value={splitType}
                onChange={changeSplitType}
                options={[
                  { value: 'exact', label: 'Exact' },
                  { value: 'percent', label: 'Percent' },
                  { value: 'shares', label: 'Shares' },
                ]}
              />
            </div>
          )}

          <ul className="mt-3 divide-y divide-border">
            {rows.map((r) => {
              const m = memberOf(r.userId)
              if (!m) return null
              const share = preview.amounts[r.userId]
              return (
                <li key={r.userId} className="flex items-center gap-3 py-2.5">
                  <button type="button" onClick={() => toggleRow(r.userId)} className={clsx('w-6 h-6 rounded-full border-2 flex items-center justify-center transition shrink-0', r.included ? 'bg-accent border-accent text-on-accent' : 'border-border')} aria-label={r.included ? 'Remove from split' : 'Include in split'}>
                    {r.included && <Check size={14} strokeWidth={3} />}
                  </button>
                  <Avatar name={m.name} color={m.avatarColor} size={30} />
                  <span className={clsx('flex-1 min-w-0 truncate text-[14px]', !r.included && 'text-muted line-through')}>{m.userId === me?.id ? 'You' : m.name}</span>
                  {advanced && r.included && (
                    <span className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={splitType === 'shares' ? 1 : 0.01}
                        value={r.value}
                        onChange={(e) => setRowValue(r.userId, e.target.value)}
                        className="field money !w-24 !py-1.5 text-right pr-7"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">{splitType === 'percent' ? '%' : splitType === 'shares' ? '×' : ''}</span>
                    </span>
                  )}
                  <span className={clsx('money text-[14px] w-24 text-right', !r.included && 'text-muted')}>{r.included && share !== undefined ? money(share, group.currency) : '—'}</span>
                </li>
              )
            })}
          </ul>

          {advanced && (
            <p className={clsx('mt-2 text-[12px] font-medium', preview.valid ? 'text-positive' : 'text-negative')}>
              {preview.valid ? 'Adds up — nice.' : preview.message}
            </p>
          )}
        </div>

        <TextArea label="Notes (optional)" placeholder="Anything worth remembering" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
    </Modal>
  )
}
