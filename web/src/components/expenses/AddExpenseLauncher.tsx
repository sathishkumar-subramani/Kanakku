import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, UserRound } from 'lucide-react'
import { useGroupsQuery } from '@/api/kanakkuApi'
import type { Group } from '@/api/types'
import { Modal } from '@/components/ui/Modal'
import { AvatarStack } from '@/components/ui/Bits'
import { ExpenseForm } from './ExpenseForm'
import { PersonalForm } from './PersonalForm'

interface LauncherApi {
  /** Open the add-expense flow. With a groupId it goes straight to that group's form; with "personal" to the personal form. */
  addExpense: (target?: string) => void
}

const Ctx = createContext<LauncherApi | null>(null)

export function AddExpenseProvider({ children }: { children: ReactNode }) {
  const [picking, setPicking] = useState(false)
  const [groupTarget, setGroupTarget] = useState<Group | null>(null)
  const [personal, setPersonal] = useState(false)
  const { data: groups } = useGroupsQuery()

  const addExpense = useCallback(
    (target?: string) => {
      if (target === 'personal') return setPersonal(true)
      if (target) {
        const g = groups?.find((x) => x.id === target)
        if (g) return setGroupTarget(g)
      }
      if (!groups || groups.length === 0) return setPersonal(true)
      setPicking(true)
    },
    [groups],
  )

  const api = useMemo(() => ({ addExpense }), [addExpense])

  return (
    <Ctx.Provider value={api}>
      {children}

      <Modal open={picking} onClose={() => setPicking(false)} title="Add expense to…" size="sm">
        <ul className="divide-y divide-border -mx-2">
          {(groups ?? []).map((g) => (
            <li key={g.id}>
              <button onClick={() => { setPicking(false); setGroupTarget(g) }} className="ghost-row w-full text-left">
                <span className="w-10 h-10 rounded-field flex items-center justify-center text-[20px]" style={{ background: g.color + '26' }}>
                  {g.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{g.name}</span>
                  <span className="block text-[12px] text-muted">{g.members.length} members</span>
                </span>
                <AvatarStack people={g.members} size={22} max={3} />
                <ChevronRight size={16} className="text-muted" />
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => { setPicking(false); setPersonal(true) }} className="ghost-row w-full text-left">
              <span className="w-10 h-10 rounded-field bg-surface2 flex items-center justify-center text-muted">
                <UserRound size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium">Personal expense</span>
                <span className="block text-[12px] text-muted">Just for your own tracking</span>
              </span>
              <ChevronRight size={16} className="text-muted" />
            </button>
          </li>
        </ul>
        {(groups ?? []).length === 0 && (
          <p className="text-[13px] text-muted mt-3">
            No groups yet.{' '}
            <Link to="/groups" className="text-info font-medium" onClick={() => setPicking(false)}>
              Create one
            </Link>{' '}
            to split expenses with others.
          </p>
        )}
      </Modal>

      {groupTarget && <ExpenseForm open onClose={() => setGroupTarget(null)} group={groupTarget} />}
      <PersonalForm open={personal} onClose={() => setPersonal(false)} />
    </Ctx.Provider>
  )
}

export function useAddExpense() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAddExpense must be used inside AddExpenseProvider')
  return ctx
}
