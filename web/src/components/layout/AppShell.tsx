import { NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { BarChart3, Home, LogOut, Moon, Plus, Settings, Sun, UserRound, Users } from 'lucide-react'
import { useLogoutMutation } from '@/api/kanakkuApi'
import { signOut as endSession } from '@/api/session'
import { useAppSelector } from '@/store'
import { useTheme } from '@/theme/ThemeProvider'
import { Avatar } from '@/components/ui/Bits'
import { useAddExpense } from '@/components/expenses/AddExpenseLauncher'

const nav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/personal', label: 'Personal', icon: UserRound },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-7 h-7 rounded-[8px] bg-accent text-on-accent font-black text-[15px] flex items-center justify-center">K</span>
      {!compact && <span className="font-bold text-[18px] tracking-tight">Kanakku</span>}
    </span>
  )
}

export function AppShell() {
  const user = useAppSelector((s) => s.auth.user)
  const refreshToken = useAppSelector((s) => s.auth.refreshToken)
  const [logout] = useLogoutMutation()
  const { resolved, setPreference } = useTheme()
  const { addExpense } = useAddExpense()
  const location = useLocation()

  async function signOut() {
    try {
      if (refreshToken) await logout({ refreshToken }).unwrap()
    } catch {
      /* already gone */
    }
    endSession()
  }

  // The FAB opens the current group's form when on a group page.
  const groupMatch = /^\/groups\/([a-f0-9]{24})/.exec(location.pathname)
  const fabTarget = groupMatch ? groupMatch[1] : location.pathname.startsWith('/personal') ? 'personal' : undefined

  return (
    <div className="min-h-screen lg:flex">
      {/* sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-surface sticky top-0 h-screen px-4 py-5">
        <div className="px-2">
          <Wordmark />
        </div>
        <button onClick={() => addExpense(fabTarget)} className="mt-6 h-11 rounded-field bg-accent text-on-accent font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition">
          <Plus size={18} /> Add expense
        </button>
        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('flex items-center gap-3 px-3 py-2.5 rounded-field text-[14px] font-medium transition', isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-surface2 hover:text-ink')}>
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="flex items-center gap-3 px-2 py-2">
            {user && <Avatar name={user.name} color={user.avatarColor} size={34} />}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">{user?.name}</p>
              <p className="text-[12px] text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            <button onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')} className="flex-1 h-9 rounded-field text-[13px] text-muted hover:bg-surface2 hover:text-ink flex items-center justify-center gap-2" title="Toggle theme">
              {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {resolved === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={signOut} className="flex-1 h-9 rounded-field text-[13px] text-muted hover:bg-surface2 hover:text-ink flex items-center justify-center gap-2">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* top bar (mobile) */}
      <header className="lg:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-1">
          <button onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full text-muted hover:bg-surface2" aria-label="Toggle theme">
            {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink to="/settings" className={({ isActive }) => clsx('p-2 rounded-full hover:bg-surface2', isActive ? 'text-accent' : 'text-muted')} aria-label="Settings">
            <Settings size={18} />
          </NavLink>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="max-w-content mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-28 lg:pb-10">
          <Outlet />
        </div>
      </main>

      {/* bottom nav + FAB (mobile) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-end h-16">
          {nav.slice(0, 2).map((n) => (
            <MobileTab key={n.to} {...n} />
          ))}
          <div className="flex justify-center">
            <button onClick={() => addExpense(fabTarget)} className="-mt-6 w-14 h-14 rounded-full bg-accent text-on-accent shadow-pop flex items-center justify-center active:scale-95 transition" aria-label="Add expense">
              <Plus size={26} />
            </button>
          </div>
          {nav.slice(2, 4).map((n) => (
            <MobileTab key={n.to} {...n} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function MobileTab({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Home; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => clsx('flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')}>
      <Icon size={20} />
      {label}
    </NavLink>
  )
}
