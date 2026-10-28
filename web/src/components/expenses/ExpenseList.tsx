import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Pencil, Trash2 } from 'lucide-react'
import { useDeleteExpenseMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { Expense, Group } from '@/api/types'
import { useAppSelector } from '@/store'
import { categoryMeta } from '@/theme/tokens'
import { dayLabel, timestampLabel } from '@/utils/dates'
import { money } from '@/utils/money'
import { Button } from '@/components/ui/Button'
import { Avatar, CategoryBadge, Money } from '@/components/ui/Bits'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ExpenseForm } from './ExpenseForm'

/** One line in a list: category badge, description, who paid, your share. */
export function ExpenseRow({ expense, onClick, showGroup }: { expense: Expense; onClick?: () => void; showGroup?: boolean }) {
  const me = useAppSelector((s) => s.auth.user)
  const iPaid = expense.paidBy.id === me?.id
  const isPersonal = expense.groupId === 'personal'
  const net = iPaid ? expense.amount - expense.myShare : -expense.myShare

  return (
    <button onClick={onClick} className={clsx('ghost-row w-full text-left', !onClick && 'cursor-default hover:bg-transparent')}>
      <CategoryBadge category={expense.category} />
      <span className="flex-1 min-w-0">
        <span className="block truncate font-medium text-[14px]">{expense.description}</span>
        <span className="block truncate text-[12px] text-muted">
          {showGroup && `${expense.groupEmoji} ${expense.groupName} · `}
          {isPersonal ? 'Personal' : iPaid ? 'You paid' : `${expense.paidBy.name} paid`}
          {!isPersonal && ` ${money(expense.amount, expense.currency)}`}
        </span>
      </span>
      <span className="text-right shrink-0">
        {isPersonal ? (
          <Money amount={expense.amount} currency={expense.currency} className="text-[14px]" />
        ) : (
          <>
            <span className="block text-[11px] text-muted">{net > 0.004 ? 'you lent' : net < -0.004 ? 'you borrowed' : 'your share'}</span>
            <Money amount={Math.abs(net) < 0.005 ? expense.myShare : Math.abs(net)} currency={expense.currency} tone={net > 0.004 ? 'positive' : net < -0.004 ? 'negative' : 'muted'} className="text-[14px] font-medium" />
          </>
        )}
      </span>
    </button>
  )
}

/** Groups a flat list by day with sticky-ish headings. */
export function ExpenseDayList({ expenses, onSelect, showGroup }: { expenses: Expense[]; onSelect?: (e: Expense) => void; showGroup?: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()]
  }, [expenses])

  return (
    <div className="space-y-4">
      {groups.map(([day, items]) => (
        <div key={day}>
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[12px] font-semibold text-muted uppercase tracking-wide">{dayLabel(day)}</span>
            <span className="money text-[12px] text-muted">{money(items.reduce((s, e) => s + (e.groupId === 'personal' ? e.amount : e.myShare), 0), items[0].currency)}</span>
          </div>
          <div className="card divide-y divide-border overflow-hidden">
            {items.map((e) => (
              <ExpenseRow key={e.id} expense={e} onClick={onSelect ? () => onSelect(e) : undefined} showGroup={showGroup} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Detail sheet: everyone's share + edit/delete. */
export function ExpenseDetail({ expense, group, onClose }: { expense: Expense | null; group: Group | undefined; onClose: () => void }) {
  const me = useAppSelector((s) => s.auth.user)
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [deleteExpense, deleteState] = useDeleteExpenseMutation()

  if (!expense || !group) return null
  const meta = categoryMeta(expense.category)

  async function remove() {
    if (!expense) return
    try {
      await deleteExpense({ id: expense.id, groupId: expense.groupId }).unwrap()
      toast.success('Expense deleted')
      setConfirm(false)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <Modal open={!editing} onClose={onClose} size="sm">
        <div className="flex items-start gap-3">
          <CategoryBadge category={expense.category} size={48} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold leading-tight truncate">{expense.description}</h2>
            <p className="text-[13px] text-muted mt-0.5">
              {meta.label} · {dayLabel(expense.date)} · {expense.groupEmoji} {expense.groupName}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-card bg-surface2 p-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] text-muted">Total</p>
            <Money amount={expense.amount} currency={expense.currency} className="text-[24px] font-medium" />
          </div>
          <div className="text-right">
            <p className="text-[12px] text-muted">Paid by</p>
            <p className="font-semibold flex items-center gap-2 justify-end">
              <Avatar name={expense.paidBy.name} color={expense.paidBy.avatarColor} size={22} />
              {expense.paidBy.id === me?.id ? 'You' : expense.paidBy.name}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[12px] font-semibold text-muted uppercase tracking-wide">Split {expense.splitType === 'equal' ? 'equally' : `by ${expense.splitType}`}</p>
        <ul className="mt-1 divide-y divide-border">
          {expense.splits.map((s) => (
            <li key={s.userId} className="flex items-center gap-3 py-2">
              <Avatar name={s.name} color={s.avatarColor} size={28} />
              <span className="flex-1 text-[14px]">{s.userId === me?.id ? 'You' : s.name}</span>
              <Money amount={s.amount} currency={expense.currency} className="text-[14px]" />
            </li>
          ))}
        </ul>

        {expense.notes && <p className="mt-3 text-[13px] text-muted whitespace-pre-wrap">{expense.notes}</p>}
        <p className="mt-3 text-[11px] text-muted">Added {timestampLabel(expense.createdAt)}{expense.updatedAt !== expense.createdAt ? ` · edited ${timestampLabel(expense.updatedAt)}` : ''}</p>

        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)}>
            Delete
          </Button>
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </Modal>

      <ExpenseForm open={editing} onClose={() => { setEditing(false); onClose() }} group={group} expense={expense} />

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} loading={deleteState.isLoading} title="Delete this expense?" message={`"${expense.description}" (${money(expense.amount, expense.currency)}) will be removed and everyone's balance will update.`} />
    </>
  )
}
