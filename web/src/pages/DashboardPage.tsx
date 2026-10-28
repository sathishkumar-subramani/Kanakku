import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Download, Plus, Sparkles } from 'lucide-react'
import { useDashboardQuery, useGroupsQuery } from '@/api/kanakkuApi'
import type { Expense } from '@/api/types'
import { useAppSelector } from '@/store'
import { currentMonthKey, monthLabel } from '@/utils/dates'
import { moneyCompact } from '@/utils/money'
import { downloadReport } from '@/utils/download'
import { Button } from '@/components/ui/Button'
import { BalanceText, EmptyState, MonthPicker, SectionTitle, Skeleton } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'
import { CategoryDonut, DailyBars, GroupBars } from '@/components/charts/Charts'
import { ExpenseDetail, ExpenseRow } from '@/components/expenses/ExpenseList'
import { PersonalForm } from '@/components/expenses/PersonalForm'
import { useAddExpense } from '@/components/expenses/AddExpenseLauncher'

function StatTile({ label, value, tone, sub, accent }: { label: string; value: string; tone?: 'positive' | 'negative'; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={accent ? 'card p-4 bg-accent-soft border-transparent' : 'card p-4'}>
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className={`money text-[24px] sm:text-[26px] font-medium mt-1 leading-none ${tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : ''}`}>{value}</p>
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
    </div>
  )
}

export function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user)
  const [month, setMonth] = useState(currentMonthKey())
  const { data, isLoading, isFetching, error } = useDashboardQuery(month)
  const { data: groups } = useGroupsQuery()
  const { addExpense } = useAddExpense()
  const toast = useToast()
  const [selected, setSelected] = useState<Expense | null>(null)
  const [downloading, setDownloading] = useState(false)
  const currency = user?.currency ?? 'INR'

  async function download() {
    setDownloading(true)
    try {
      await downloadReport(month, 'pdf')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  const trend = data && data.prevMonthTotal > 0 ? ((data.totalSpent - data.prevMonthTotal) / data.prevMonthTotal) * 100 : null
  const selectedGroup = selected && selected.groupId !== 'personal' ? groups?.find((g) => g.id === selected.groupId) : undefined
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{greeting}</p>
          <h1 className="text-[26px] font-bold leading-tight">{user?.name?.split(' ')[0]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <Button variant="secondary" icon={<Download size={16} />} onClick={download} loading={downloading} className="hidden sm:inline-flex">
            PDF
          </Button>
        </div>
      </div>

      {error && <div className="rounded-field bg-negative-soft text-negative text-[13px] px-4 py-3">Couldn't load the dashboard. {isFetching ? 'Retrying…' : 'Pull to refresh or try again in a moment.'}</div>}

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label={`This month · ${monthLabel(month).split(' ')[0]}`}
              value={moneyCompact(data.totalSpent, currency)}
              accent
              sub={
                trend === null ? (
                  <span>{data.personalSpent > 0 ? `${moneyCompact(data.personalSpent, currency)} personal` : 'No data last month'}</span>
                ) : (
                  <span className={`inline-flex items-center gap-1 ${trend > 0 ? 'text-negative' : 'text-positive'}`}>
                    {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(Math.round(trend))}% vs last month
                  </span>
                )
              }
            />
            <StatTile label="You owe" value={moneyCompact(data.youOwe, currency)} tone={data.youOwe > 0 ? 'negative' : undefined} sub="across all groups" />
            <StatTile label="You are owed" value={moneyCompact(data.youAreOwed, currency)} tone={data.youAreOwed > 0 ? 'positive' : undefined} sub="across all groups" />
            <StatTile label="I paid for groups" value={moneyCompact(data.iPaid, currency)} sub={`your share was ${moneyCompact(data.groupShare, currency)}`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="card p-5">
              <SectionTitle>Spend by group</SectionTitle>
              <GroupBars data={data.byGroup} currency={currency} />
            </section>
            <section className="card p-5">
              <SectionTitle>By category</SectionTitle>
              <CategoryDonut data={data.byCategory} currency={currency} total={data.totalSpent} />
            </section>
          </div>

          <section className="card p-5">
            <SectionTitle right={<span className="text-[12px] text-muted">your share, per day</span>}>Daily spend</SectionTitle>
            <DailyBars data={data.daily} currency={currency} />
          </section>

          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            <section>
              <SectionTitle
                right={
                  <Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={() => addExpense()}>
                    Add
                  </Button>
                }
              >
                Recent
              </SectionTitle>
              {data.recent.length === 0 ? (
                <div className="card">
                  <EmptyState icon={<Sparkles size={28} />} title="No expenses yet" body="Add your first expense — a group one or a personal one." action={<Button onClick={() => addExpense()}>Add expense</Button>} />
                </div>
              ) : (
                <div className="card divide-y divide-border overflow-hidden">
                  {data.recent.map((e) => (
                    <ExpenseRow key={e.id} expense={e} showGroup onClick={() => setSelected(e)} />
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5">
              <SectionTitle>Group balances</SectionTitle>
              {data.groupBalances.length === 0 ? (
                <p className="text-[13px] text-muted">
                  You're not in any group yet.{' '}
                  <Link to="/groups" className="text-info font-medium">
                    Create or join one.
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.groupBalances.map((g) => (
                    <li key={g.groupId}>
                      <Link to={`/groups/${g.groupId}?tab=balances`} className="ghost-row -mx-3">
                        <span className="w-9 h-9 rounded-field flex items-center justify-center text-[18px]" style={{ background: g.color + '26' }}>
                          {g.emoji}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-medium truncate">{g.name}</span>
                          <BalanceText balance={g.balance} currency={currency} className="text-[12px]" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="secondary" full className="mt-4 sm:hidden" icon={<Download size={16} />} onClick={download} loading={downloading}>
                Download PDF
              </Button>
            </section>
          </div>
        </>
      )}

      {selected && selected.groupId !== 'personal' && <ExpenseDetail expense={selected} group={selectedGroup} onClose={() => setSelected(null)} />}
      {selected && selected.groupId === 'personal' && <PersonalRecentDetail expense={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

/** A personal expense opened from the dashboard's recent list → straight into the edit sheet. */
function PersonalRecentDetail({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  return (
    <PersonalForm
      open
      onClose={onClose}
      expense={{ id: expense.id, description: expense.description, amount: expense.amount, category: expense.category, date: expense.date, notes: expense.notes, createdAt: expense.createdAt, updatedAt: expense.updatedAt }}
    />
  )
}
