import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Copy, HandCoins, Link2, LogOut, Plus, RefreshCw, Search, Settings2, Share2, Trash2, UserPlus, X } from 'lucide-react'
import {
  useActivityQuery,
  useAddMemberMutation,
  useBalancesQuery,
  useDeleteGroupMutation,
  useDeleteSettlementMutation,
  useExpensesQuery,
  useGroupQuery,
  useRegenerateInviteMutation,
  useRemoveMemberMutation,
  useSettlementsQuery,
  useUpdateGroupMutation,
} from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { Debt, Expense, Group } from '@/api/types'
import { useAppSelector } from '@/store'
import { CATEGORIES, CATEGORY_KEYS } from '@/theme/tokens'
import { currentMonthKey, dayLabel, timestampLabel } from '@/utils/dates'
import { money, moneyCompact } from '@/utils/money'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Avatar, AvatarStack, BalanceText, EmptyState, ErrorNote, Money, MonthPicker, Pill, Skeleton } from '@/components/ui/Bits'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseDayList, ExpenseDetail } from '@/components/expenses/ExpenseList'
import { SettleUpForm } from '@/components/groups/SettleUpForm'
import { GroupForm } from '@/components/groups/GroupForms'

type Tab = 'expenses' | 'balances' | 'activity' | 'members'
const TABS: { value: Tab; label: string }[] = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'balances', label: 'Balances' },
  { value: 'activity', label: 'Activity' },
  { value: 'members', label: 'Members' },
]

export function GroupPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'expenses'
  const { data: group, isLoading, error } = useGroupQuery(id)
  const [adding, setAdding] = useState(false)
  const [settle, setSettle] = useState<{ open: boolean; preset?: { fromUserId: string; toUserId: string; amount: number } | null }>({ open: false })
  const user = useAppSelector((s) => s.auth.user)

  function setTab(t: Tab) {
    setParams((p) => {
      p.set('tab', t)
      return p
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-60" />
      </div>
    )
  }
  if (error || !group) {
    return (
      <div className="card">
        <EmptyState title="Couldn't open this group" body={error ? errorMessage(error) : 'It may have been deleted.'} action={<Link to="/groups"><Button variant="secondary">Back to groups</Button></Link>} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link to="/groups" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} /> Groups
      </Link>

      {/* header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="w-14 h-14 rounded-card flex items-center justify-center text-[28px] shrink-0" style={{ background: group.color + '26' }}>
            {group.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-bold leading-tight truncate">{group.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
              <AvatarStack people={group.members.map((m) => ({ name: m.userId === user?.id ? 'You' : m.name, avatarColor: m.avatarColor }))} size={22} max={5} />
              <span>
                {group.members.length} {group.members.length === 1 ? 'member' : 'members'} · {moneyCompact(group.totalSpent, group.currency)} all time
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<HandCoins size={16} />} onClick={() => setSettle({ open: true, preset: null })}>
              Settle up
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>
              Add expense
            </Button>
          </div>
        </div>
        <div className={clsx('mt-4 rounded-field px-4 py-3 flex items-center gap-2', group.myBalance > 0.004 ? 'bg-positive-soft' : group.myBalance < -0.004 ? 'bg-negative-soft' : 'bg-surface2')}>
          {Math.abs(group.myBalance) < 0.005 && <CheckCircle2 size={16} className="text-muted" />}
          <span className="text-[14px]">
            Overall, <BalanceText balance={group.myBalance} currency={group.currency} /> in this group.
          </span>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)} className={clsx('tab shrink-0', tab === t.value && 'tab-active')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && <ExpensesTab group={group} onAdd={() => setAdding(true)} />}
      {tab === 'balances' && <BalancesTab group={group} onSettle={(d) => setSettle({ open: true, preset: d ? { fromUserId: d.fromUserId, toUserId: d.toUserId, amount: d.amount } : null })} />}
      {tab === 'activity' && <ActivityTab group={group} />}
      {tab === 'members' && <MembersTab group={group} />}

      <ExpenseForm open={adding} onClose={() => setAdding(false)} group={group} />
      <SettleUpForm open={settle.open} onClose={() => setSettle({ open: false })} group={group} preset={settle.preset} />
    </div>
  )
}

// ---------------- Expenses ----------------

function ExpensesTab({ group, onAdd }: { group: Group; onAdd: () => void }) {
  const [month, setMonth] = useState<string>(currentMonthKey())
  const [all, setAll] = useState(false)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Expense | null>(null)
  const { data, isLoading, isFetching } = useExpensesQuery({ groupId: group.id, month: all ? undefined : month, category: category || undefined, search: search || undefined, pageSize: 200 })

  const total = useMemo(() => (data?.items ?? []).reduce((s, e) => s + e.amount, 0), [data])
  const myShare = useMemo(() => (data?.items ?? []).reduce((s, e) => s + e.myShare, 0), [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker month={month} onChange={(m) => { setMonth(m); setAll(false) }} allowAll isAll={all} onAll={() => setAll((v) => !v)} />
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="field !pl-9 !py-2" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted" aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <button onClick={() => setCategory('')} className={clsx('chip shrink-0', !category && 'chip-active')}>
          All
        </button>
        {CATEGORY_KEYS.map((k) => (
          <button key={k} onClick={() => setCategory(category === k ? '' : k)} className={clsx('chip shrink-0', category === k && 'chip-active')}>
            {CATEGORIES[k].emoji} {CATEGORIES[k].label}
          </button>
        ))}
      </div>

      {data && data.items.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted px-1">
          <span>
            {data.total} {data.total === 1 ? 'expense' : 'expenses'}
          </span>
          <span>
            Group total <Money amount={total} currency={group.currency} className="text-ink" />
          </span>
          <span>
            Your share <Money amount={myShare} currency={group.currency} className="text-ink" />
          </span>
          {isFetching && <span>Updating…</span>}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !data || data.items.length === 0 ? (
        <div className="card">
          <EmptyState title={search || category ? 'Nothing matches' : all ? 'No expenses yet' : 'No expenses this month'} body={search || category ? 'Try clearing the filters.' : 'Add the first one — everyone in the group will see it.'} action={!search && !category ? <Button onClick={onAdd} icon={<Plus size={16} />}>Add expense</Button> : undefined} />
        </div>
      ) : (
        <ExpenseDayList expenses={data.items} onSelect={setSelected} />
      )}

      <ExpenseDetail expense={selected} group={group} onClose={() => setSelected(null)} />
    </div>
  )
}

// ---------------- Balances ----------------

function BalancesTab({ group, onSettle }: { group: Group; onSettle: (debt?: Debt) => void }) {
  const user = useAppSelector((s) => s.auth.user)
  const toast = useToast()
  const { data, isLoading } = useBalancesQuery(group.id)
  const { data: settlements } = useSettlementsQuery(group.id)
  const [deleteSettlement] = useDeleteSettlementMutation()
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const name = (id: string, n: string) => (id === user?.id ? 'You' : n)

  async function removeSettlement() {
    if (!confirm) return
    setBusy(true)
    try {
      await deleteSettlement({ id: confirm, groupId: group.id }).unwrap()
      toast.success('Payment removed')
      setConfirm(null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !data) return <Skeleton className="h-60" />
  const allSettled = data.debts.length === 0

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold">Who pays whom</h2>
          <Pill tone="muted">{data.simplified ? 'simplified' : 'exact pairs'}</Pill>
        </div>
        {allSettled ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="pop w-12 h-12 rounded-full bg-positive-soft text-positive flex items-center justify-center">
              <CheckCircle2 size={26} />
            </span>
            <p className="font-semibold mt-3">Everyone is settled up</p>
            <p className="text-[13px] text-muted mt-1">Nothing to pay right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.debts.map((d, i) => {
              const involvesMe = d.fromUserId === user?.id || d.toUserId === user?.id
              return (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="flex-1 min-w-0 text-[14px]">
                    <span className={clsx('font-semibold', d.fromUserId === user?.id && 'text-negative')}>{name(d.fromUserId, d.fromName)}</span> {d.fromUserId === user?.id ? 'owe' : 'owes'}{' '}
                    <span className={clsx('font-semibold', d.toUserId === user?.id && 'text-positive')}>{name(d.toUserId, d.toName).toLowerCase() === 'you' ? 'you' : d.toName}</span>
                  </span>
                  <Money amount={d.amount} currency={group.currency} className={clsx('text-[14px] font-medium', d.fromUserId === user?.id && 'text-negative', d.toUserId === user?.id && 'text-positive')} />
                  <Button size="sm" variant={involvesMe ? 'soft' : 'secondary'} onClick={() => onSettle(d)}>
                    Settle
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-[16px] font-bold mb-3">Member balances</h2>
        <ul className="divide-y divide-border">
          {data.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-3">
              <Avatar name={m.name} color={m.avatarColor} size={34} />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-medium truncate">{name(m.userId, m.name)}</span>
                <span className="block text-[12px] text-muted">
                  paid {money(m.paid, group.currency)} · share {money(m.share, group.currency)}
                </span>
              </span>
              <BalanceText balance={m.balance} currency={group.currency} subject={m.userId === user?.id ? 'you' : m.name.split(' ')[0]} className="text-[13px] text-right" />
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold">Payments recorded</h2>
          <Button size="sm" variant="secondary" icon={<HandCoins size={14} />} onClick={() => onSettle()}>
            Record a payment
          </Button>
        </div>
        {!settlements || settlements.length === 0 ? (
          <p className="text-[13px] text-muted">No payments yet. When someone pays someone back, record it here so balances stay right.</p>
        ) : (
          <ul className="divide-y divide-border">
            {settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="flex -space-x-2">
                  <Avatar name={s.from.name} color={s.from.avatarColor} size={28} className="ring-2 ring-surface" />
                  <Avatar name={s.to.name} color={s.to.avatarColor} size={28} className="ring-2 ring-surface" />
                </span>
                <span className="flex-1 min-w-0 text-[14px]">
                  <span className="font-medium">{name(s.from.id, s.from.name)}</span> paid <span className="font-medium">{name(s.to.id, s.to.name).toLowerCase() === 'you' ? 'you' : s.to.name}</span>
                  <span className="block text-[12px] text-muted">
                    {dayLabel(s.date)}
                    {s.note ? ` · ${s.note}` : ''}
                  </span>
                </span>
                <Money amount={s.amount} currency={group.currency} className="text-[14px]" />
                <button onClick={() => setConfirm(s.id)} className="p-1.5 rounded-full text-muted hover:text-negative hover:bg-negative-soft" aria-label="Delete payment">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={removeSettlement} loading={busy} title="Remove this payment?" message="Balances will go back to what they were before it was recorded." confirmLabel="Remove" />
    </div>
  )
}

// ---------------- Activity ----------------

const activityIcon: Record<string, string> = {
  'expense.added': '🧾',
  'expense.updated': '✏️',
  'expense.deleted': '🗑️',
  'settlement.added': '🤝',
  'settlement.deleted': '↩️',
  'member.joined': '👋',
  'member.left': '🚪',
  'group.updated': '⚙️',
  'group.created': '✨',
}

function ActivityTab({ group }: { group: Group }) {
  const { data, isLoading } = useActivityQuery({ id: group.id, limit: 100 })
  if (isLoading || !data) return <Skeleton className="h-48" />
  if (data.length === 0)
    return (
      <div className="card">
        <EmptyState title="Nothing has happened yet" body="Expenses, payments and member changes show up here." />
      </div>
    )
  return (
    <div className="card divide-y divide-border">
      {data.map((a) => (
        <div key={a.id} className="flex items-start gap-3 px-4 py-3">
          <span className="w-9 h-9 rounded-field bg-surface2 flex items-center justify-center text-[18px] shrink-0">{activityIcon[a.type] ?? '•'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px]">{a.message}</p>
            <p className="text-[12px] text-muted">{timestampLabel(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------- Members ----------------

function MembersTab({ group }: { group: Group }) {
  const user = useAppSelector((s) => s.auth.user)
  const navigate = useNavigate()
  const toast = useToast()
  const isOwner = group.members.some((m) => m.userId === user?.id && m.role === 'owner')
  const [email, setEmail] = useState('')
  const [addMember, addState] = useAddMemberMutation()
  const [removeMember] = useRemoveMemberMutation()
  const [regenerate, regenState] = useRegenerateInviteMutation()
  const [updateGroup] = useUpdateGroupMutation()
  const [deleteGroup, deleteState] = useDeleteGroupMutation()
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const inviteLink = `${window.location.origin}/join/${group.inviteCode}`

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy — select it and copy manually.')
    }
  }
  async function share() {
    const text = `Join "${group.name}" on Kanakku with code ${group.inviteCode}: ${inviteLink}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${group.name} on Kanakku`, text, url: inviteLink })
        return
      } catch {
        /* cancelled */
      }
    }
    copy(text, 'Invite')
  }

  async function add() {
    setError('')
    try {
      await addMember({ id: group.id, email: email.trim() }).unwrap()
      toast.success('Member added')
      setEmail('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function remove() {
    if (!confirmRemove) return
    setBusy(true)
    const leaving = confirmRemove.userId === user?.id
    try {
      await removeMember({ id: group.id, userId: confirmRemove.userId }).unwrap()
      toast.success(leaving ? 'You left the group' : `${confirmRemove.name} removed`)
      setConfirmRemove(null)
      if (leaving) navigate('/groups')
    } catch (e) {
      setConfirmRemove(null)
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function destroy() {
    try {
      await deleteGroup(group.id).unwrap()
      toast.success('Group deleted')
      navigate('/groups')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <section className="card p-5">
        <h2 className="text-[16px] font-bold">Invite people</h2>
        <p className="text-[13px] text-muted mt-1">Share this code — anyone with a Kanakku account can join with it.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="money text-[26px] tracking-[0.2em] font-medium bg-surface2 rounded-field px-4 py-2 flex-1 text-center">{group.inviteCode}</span>
          <button onClick={() => copy(group.inviteCode, 'Code')} className="h-12 w-12 rounded-field bg-surface2 flex items-center justify-center text-muted hover:text-ink" aria-label="Copy code">
            <Copy size={18} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Link2 size={14} />} onClick={() => copy(inviteLink, 'Link')}>
            Copy link
          </Button>
          <Button variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={share}>
            Share
          </Button>
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              loading={regenState.isLoading}
              onClick={async () => {
                try {
                  await regenerate(group.id).unwrap()
                  toast.success('New code generated — the old one no longer works')
                } catch (e) {
                  toast.error(errorMessage(e))
                }
              }}
            >
              New code
            </Button>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-[14px] font-semibold">Add by email</p>
          <p className="text-[12px] text-muted">They need a Kanakku account already.</p>
          <div className="mt-2 flex gap-2">
            <TextField className="flex-1" type="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <Button icon={<UserPlus size={16} />} onClick={add} loading={addState.isLoading} disabled={!email.includes('@')}>
              Add
            </Button>
          </div>
          {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[16px] font-bold mb-3">Members</h2>
        <ul className="divide-y divide-border">
          {group.members.map((m) => {
            const isMe = m.userId === user?.id
            return (
              <li key={m.userId} className="flex items-center gap-3 py-3">
                <Avatar name={m.name} color={m.avatarColor} size={34} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate">
                    {isMe ? 'You' : m.name} {m.role === 'owner' && <Pill tone="accent" className="ml-1">owner</Pill>}
                  </span>
                  <span className="block text-[12px] text-muted truncate">{m.email}</span>
                </span>
                {isMe ? (
                  <Button size="sm" variant="ghost" icon={<LogOut size={14} />} onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}>
                    Leave
                  </Button>
                ) : isOwner ? (
                  <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}>
                    Remove
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {isOwner && (
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 size={16} className="text-muted" />
            <h2 className="text-[16px] font-bold">Group settings</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3 rounded-field bg-surface2 px-4 py-3">
              <div>
                <p className="text-[14px] font-medium">Simplify debts</p>
                <p className="text-[12px] text-muted">Fewer payments: A→C instead of A→B→C.</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 accent-[var(--accent)]"
                checked={group.simplifyDebts}
                onChange={async (e) => {
                  try {
                    await updateGroup({ id: group.id, simplifyDebts: e.target.checked }).unwrap()
                  } catch (err) {
                    toast.error(errorMessage(err))
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit name & icon
              </Button>
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                Delete group
              </Button>
            </div>
          </div>
        </section>
      )}

      <GroupForm open={editing} onClose={() => setEditing(false)} group={group} />
      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={remove}
        loading={busy}
        title={confirmRemove?.userId === user?.id ? 'Leave this group?' : `Remove ${confirmRemove?.name}?`}
        message="This only works when that person's balance is zero. Past expenses stay in the group."
        confirmLabel={confirmRemove?.userId === user?.id ? 'Leave' : 'Remove'}
      />
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={destroy} loading={deleteState.isLoading} title="Delete this group?" message="Every expense and payment in it will be deleted for everyone. This cannot be undone." confirmLabel="Delete everything" />
    </div>
  )
}
