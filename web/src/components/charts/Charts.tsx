import { useMemo } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CategorySpend, DailySpend, GroupSpend } from '@/api/types'
import { categoryMeta } from '@/theme/tokens'
import { money, moneyCompact } from '@/utils/money'
import { dayShort } from '@/utils/dates'
import { EmptyState } from '@/components/ui/Bits'

/** Horizontal bars — one per group (and "Personal"). Plain divs: crisper than a chart lib for 2–6 rows. */
export function GroupBars({ data, currency }: { data: GroupSpend[]; currency: string }) {
  const max = Math.max(...data.map((d) => d.amount), 0)
  if (data.length === 0) return <EmptyState title="Nothing spent yet this month" body="Expenses you add (or are part of) will show up here by group." />
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.groupId}>
          <div className="flex items-center justify-between text-[13px] mb-1">
            <span className="font-medium truncate">
              {d.emoji} {d.name} <span className="text-muted font-normal">· {d.count}</span>
            </span>
            <span className="money">{money(d.amount, currency)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${max > 0 ? Math.max(3, (d.amount / max) * 100) : 0}%`, background: d.color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function CategoryDonut({ data, currency, total }: { data: CategorySpend[]; currency: string; total: number }) {
  const rows = useMemo(() => data.map((d) => ({ ...d, meta: categoryMeta(d.category) })), [data])
  if (rows.length === 0) return <EmptyState title="No categories yet" body="Add an expense and pick a category to see the breakdown." />
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-[170px] h-[170px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.category} fill={r.meta.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => money(Number(value), currency)} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} itemStyle={{ color: 'var(--text)' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-muted">Total</span>
          <span className="money text-[15px] font-medium">{moneyCompact(total, currency)}</span>
        </div>
      </div>
      <ul className="flex-1 w-full grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((r) => (
          <li key={r.category} className="flex items-center gap-2 text-[13px] min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.meta.color }} />
            <span className="truncate">
              {r.meta.emoji} {r.meta.label}
            </span>
            <span className="money ml-auto text-muted">{total > 0 ? Math.round((r.amount / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DailyBars({ data, currency }: { data: DailySpend[]; currency: string }) {
  const hasAny = data.some((d) => d.amount > 0)
  if (!hasAny) return <EmptyState title="A quiet month so far" body="Daily spend appears here as you add expenses." />
  return (
    <div className="h-[180px] -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(data.length / 10) - 1)} />
          <YAxis hide />
          <Tooltip cursor={{ fill: 'var(--surface2)' }} formatter={(value) => [money(Number(value), currency), 'Spent']} labelFormatter={(label) => dayShort(String(label))} contentStyle={{ fontSize: 12 }} itemStyle={{ color: 'var(--text)' }} />
          <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
