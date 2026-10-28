import { useMemo, useState } from 'react'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { useDeletePersonalMutation, usePersonalQuery } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { PersonalExpense } from '@/api/types'
import { useAppSelector } from '@/store'
import { categoryMeta } from '@/theme/tokens'
import { currentMonthKey, dayLabel } from '@/utils/dates'
import { money, moneyCompact } from '@/utils/money'
import { Button } from '@/components/ui/Button'
import { CategoryBadge, EmptyState, Money, MonthPicker, Skeleton } from '@/components/ui/Bits'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { PersonalForm } from '@/components/expenses/PersonalForm'

export function PersonalPage() {
  const user = useAppSelector((s) => s.auth.user)
  const currency = user?.currency ?? 'INR'
  const toast = useToast()
  const [month, setMonth] = useState(currentMonthKey())
  const { data, isLoading } = usePersonalQuery({ month })
  const [remove, removeState] = useDeletePersonalMutation()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PersonalExpense | null>(null)
  const [confirm, setConfirm] = useState<PersonalExpense | null>(null)

  const total = useMemo(() => (data ?? []).reduce((s, p) => s + p.amount, 0), [data])
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of data ?? []) m.set(p.category, (m.get(p.category) ?? 0) + p.amount)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [data])
  const days = useMemo(() => {
    const m = new Map<string, PersonalExpense[]>()
    for (const p of data ?? []) m.set(p.date, [...(m.get(p.date) ?? []), p])
    return [...m.entries()]
  }, [data])

  async function destroy() {
    if (!confirm) return
    try {
      await remove(confirm.id).unwrap()
      toast.success('Expense deleted')
      setConfirm(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold">Personal</h1>
          <p className="text-[13px] text-muted">Your own spending — nobody else sees this.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Add
          </Button>
        </div>
      </div>

      <div className="card p-5 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[12px] text-muted">Total this month</p>
          <p className="money text-[28px] font-medium leading-tight">{moneyCompact(total, currency)}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {byCategory.map(([cat, amt]) => {
            const meta = categoryMeta(cat)
            return (
              <li key={cat} className="chip">
                {meta.emoji} {meta.label} <span className="money text-muted">{moneyCompact(amt, currency)}</span>
              </li>
            )
          })}
        </ul>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : days.length === 0 ? (
        <div className="card">
          <EmptyState icon={<UserRound size={28} />} title="Nothing here yet" body="Track coffee, autos, recharges — anything that's just yours. It rolls into your dashboard totals." action={<Button onClick={() => setAdding(true)}>Add a personal expense</Button>} />
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center justify-between px-3 mb-1">
                <span className="text-[12px] font-semibold text-muted uppercase tracking-wide">{dayLabel(day)}</span>
                <span className="money text-[12px] text-muted">{money(items.reduce((s, p) => s + p.amount, 0), currency)}</span>
              </div>
              <div className="card divide-y divide-border overflow-hidden">
                {items.map((p) => (
                  <div key={p.id} className="ghost-row">
                    <button onClick={() => setEditing(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <CategoryBadge category={p.category} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium text-[14px]">{p.description}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {categoryMeta(p.category).label}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </span>
                      </span>
                      <Money amount={p.amount} currency={currency} className="text-[14px]" />
                    </button>
                    <button onClick={() => setConfirm(p)} className="p-1.5 rounded-full text-muted hover:text-negative hover:bg-negative-soft" aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <PersonalForm open={adding} onClose={() => setAdding(false)} />
      <PersonalForm open={!!editing} onClose={() => setEditing(null)} expense={editing} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={destroy} loading={removeState.isLoading} title="Delete this expense?" message={confirm ? `"${confirm.description}" (${money(confirm.amount, currency)}) will be removed.` : ''} />
    </div>
  )
}
