import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLoginMutation, useRegisterMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import { signIn } from '@/api/session'
import { useAppSelector } from '@/store'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorNote } from '@/components/ui/Bits'
import { Wordmark } from '@/components/layout/AppShell'

function useSlowHint(active: boolean) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) {
      setSlow(false)
      return
    }
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [active])
  return slow
}

function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Wordmark />
        </div>
        <div className="card p-6 rise">
          <h1 className="text-[22px] font-bold">{title}</h1>
          <p className="text-[13px] text-muted mt-1">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <p className="text-center text-[13px] text-muted mt-5">{footer}</p>
      </div>
    </div>
  )
}

export function LoginPage() {
  const user = useAppSelector((s) => s.auth.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [login, state] = useLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const slow = useSlowHint(state.isLoading)
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={returnTo} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await login({ email: email.trim(), password }).unwrap()
      signIn(res)
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to your shared ledger."
      footer={
        <>
          New here?{' '}
          <Link to="/register" state={location.state} className="text-info font-medium">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" full size="lg" loading={state.isLoading}>
          Sign in
        </Button>
        {slow && <p className="text-[12px] text-muted text-center">Waking up the server… this can take up to a minute the first time.</p>}
      </form>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const user = useAppSelector((s) => s.auth.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [register, state] = useRegisterMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const slow = useSlowHint(state.isLoading)
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={returnTo} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Use at least 6 characters for the password.')
    try {
      const res = await register({ name: name.trim(), email: email.trim(), password }).unwrap()
      signIn(res)
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <AuthFrame
      title="Create your account"
      subtitle="Takes ten seconds. Your friends join with an invite code."
      footer={
        <>
          Already have one?{' '}
          <Link to="/login" state={location.state} className="text-info font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <TextField label="Your name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="How friends see you" maxLength={60} />
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 6 characters" />
        <Button type="submit" full size="lg" loading={state.isLoading}>
          Create account
        </Button>
        {slow && <p className="text-[12px] text-muted text-center">Waking up the server… this can take up to a minute the first time.</p>}
      </form>
    </AuthFrame>
  )
}
