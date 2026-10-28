import { useState } from 'react'
import clsx from 'clsx'
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { useGroupsQuery, useReportMonthsQuery } from '@/api/kanakkuApi'
import { monthLabel } from '@/utils/dates'
import { downloadReport } from '@/utils/download'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'

export function ReportsPage() {
  const { data: months, isLoading } = useReportMonthsQuery()
  const { data: groups } = useGroupsQuery()
  const toast = useToast()
  const [month, setMonth] = useState<string | null>(null)
  const [scope, setScope] = useState<string>('')
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null)

  const selected = month ?? months?.[0] ?? null

  async function download(format: 'pdf' | 'csv') {
    if (!selected) return
    setBusy(format)
    try {
      await downloadReport(selected, format, scope || undefined)
      toast.success(`${format.toUpperCase()} downloaded`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold">Reports</h1>
        <p className="text-[13px] text-muted">A month-end PDF you can keep, or a CSV for your own analysis in Excel.</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
        <section className="card p-3">
          <p className="px-2 pb-2 text-[12px] font-semibold text-muted uppercase tracking-wide">Months</p>
          {isLoading || !months ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="space-y-0.5 max-h-[420px] overflow-y-auto">
              {months.map((m) => (
                <li key={m}>
                  <button onClick={() => setMonth(m)} className={clsx('w-full text-left px-3 py-2.5 rounded-field text-[14px] font-medium transition', selected === m ? 'bg-accent-soft text-ink' : 'hover:bg-surface2 text-muted')}>
                    {monthLabel(m)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          {selected ? (
            <>
              <h2 className="text-[20px] font-bold">{monthLabel(selected)}</h2>
              <p className="text-[13px] text-muted mt-1">Choose what to include, then download.</p>

              <div className="mt-4">
                <p className="field-label">Include</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setScope('')} className={clsx('chip', scope === '' && 'chip-active')}>
                    Everything
                  </button>
                  <button onClick={() => setScope('personal')} className={clsx('chip', scope === 'personal' && 'chip-active')}>
                    👤 Personal only
                  </button>
                  {(groups ?? []).map((g) => (
                    <button key={g.id} onClick={() => setScope(g.id)} className={clsx('chip', scope === g.id && 'chip-active')}>
                      {g.emoji} {g.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid sm:grid-cols-2 gap-3">
                <div className="rounded-card border border-border p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileText size={18} className="text-accent" /> PDF report
                  </div>
                  <p className="text-[13px] text-muted mt-1">Summary, spend by group and category, every expense with your share, payments and current balances.</p>
                  <Button className="mt-3" icon={<FileDown size={16} />} onClick={() => download('pdf')} loading={busy === 'pdf'} disabled={busy === 'csv'}>
                    Download PDF
                  </Button>
                </div>
                <div className="rounded-card border border-border p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileSpreadsheet size={18} className="text-positive" /> CSV export
                  </div>
                  <p className="text-[13px] text-muted mt-1">One row per expense — open it in Excel or Google Sheets for your own pivots.</p>
                  <Button className="mt-3" variant="secondary" icon={<FileDown size={16} />} onClick={() => download('csv')} loading={busy === 'csv'} disabled={busy === 'pdf'}>
                    Download CSV
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">Add a few expenses first — months with data will appear here.</p>
          )}
        </section>
      </div>
    </div>
  )
}
