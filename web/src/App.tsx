import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store, useAppSelector } from '@/store'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { AddExpenseProvider } from '@/components/expenses/AddExpenseLauncher'
import { LoginPage, RegisterPage } from '@/pages/AuthPages'
import { DashboardPage } from '@/pages/DashboardPage'
import { GroupsPage } from '@/pages/GroupsPage'
import { GroupPage } from '@/pages/GroupPage'
import { PersonalPage } from '@/pages/PersonalPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { JoinPage } from '@/pages/JoinPage'

function RequireAuth() {
  const user = useAppSelector((s) => s.auth.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return (
    <AddExpenseProvider>
      <Outlet />
    </AddExpenseProvider>
  )
}

function NotFound() {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold">That page doesn't exist.</p>
      <a href="/" className="text-info text-[13px] font-medium">
        Go home
      </a>
    </div>
  )
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/groups/:id" element={<GroupPage />} />
                  <Route path="/personal" element={<PersonalPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  )
}
