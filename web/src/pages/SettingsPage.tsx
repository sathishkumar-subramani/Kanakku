import { useEffect, useRef, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { LogOut } from 'lucide-react'
import { useChangePasswordMutation, useLogoutMutation, useMeQuery, useUpdateMeMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import { signOut as endSession, updateSessionUser } from '@/api/session'
import { useAppSelector } from '@/store'
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider'
import { AVATAR_PALETTE, CURRENCIES } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { Avatar, ErrorNote, Segmented } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'

export function SettingsPage() {
  const user = useAppSelector((s) => s.auth.user)
  const refreshToken = useAppSelector((s) => s.auth.refreshToken)
  const toast = useToast()
  const { data: fresh } = useMeQuery()
  const [updateMe, updateState] = useUpdateMeMutation()
  const [changePassword, pwState] = useChangePasswordMutation()
  const [logout] = useLogoutMutation()
  const { preference, setPreference } = useTheme()

  const [name, setName] = useState(user?.name ?? '')
  const [color, setColor] = useState(user?.avatarColor ?? AVATAR_PALETTE[0])
  const [currency, setCurrency] = useState(user?.currency ?? 'INR')
  const [profileError, setProfileError] = useState('')

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState('')

  // Sync the form from the server once, and only if the person hasn't started editing yet.
  const touched = useRef(false)
  const synced = useRef(false)
  useEffect(() => {
    if (fresh && !synced.current) {
      synced.current = true
      updateSessionUser(fresh)
      if (!touched.current) {
        setName(fresh.name)
        setColor(fresh.avatarColor)
        setCurrency(fresh.currency)
      }
    }
  }, [fresh])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setProfileError('')
    try {
      const u = await updateMe({ name: name.trim(), avatarColor: color, currency }).unwrap()
      updateSessionUser(u)
      toast.success('Profile saved')
    } catch (err) {
      setProfileError(errorMessage(err))
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setPwError('')
    if (next.length < 6) return setPwError('New password needs at least 6 characters.')
    if (next !== confirm) return setPwError("The two new passwords don't match.")
    try {
      await changePassword({ currentPassword: current, newPassword: next, refreshToken: refreshToken ?? undefined }).unwrap()
      toast.success('Password changed. Other devices were signed out.')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setPwError(errorMessage(err))
    }
  }

  async function signOut() {
    try {
      if (refreshToken) await logout({ refreshToken }).unwrap()
    } catch {
      /* ignore */
    }
    endSession()
  }

  const dirty = name.trim() !== (user?.name ?? '') || color !== user?.avatarColor || currency !== user?.currency

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-[26px] font-bold">Settings</h1>
        <p className="text-[13px] text-muted">Just the essentials.</p>
      </div>

      <form onSubmit={saveProfile} className="card p-5 space-y-4">
        <h2 className="text-[16px] font-bold">Profile</h2>
        <ErrorNote>{profileError}</ErrorNote>
        <div className="flex items-center gap-4">
          <Avatar name={name || '?'} color={color} size={56} />
          <div className="flex flex-wrap gap-2">
            {AVATAR_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => { touched.current = true; setColor(c) }} className={clsx('w-8 h-8 rounded-full ring-offset-2 ring-offset-surface transition', color === c && 'ring-2 ring-ink')} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
        <TextField label="Name" value={name} onChange={(e) => { touched.current = true; setName(e.target.value) }} maxLength={60} />
        <TextField label="Email" value={user?.email ?? ''} readOnly disabled hint="Email can't be changed." />
        <SelectField label="Currency" value={currency} onChange={(e) => { touched.current = true; setCurrency(e.target.value) }} hint="Used for personal expenses, dashboard totals and reports. Groups keep their own currency.">
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <div className="flex justify-end">
          <Button type="submit" loading={updateState.isLoading} disabled={!dirty || !name.trim()}>
            Save
          </Button>
        </div>
      </form>

      <section className="card p-5">
        <h2 className="text-[16px] font-bold mb-3">Appearance</h2>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      <form onSubmit={savePassword} className="card p-5 space-y-4">
        <h2 className="text-[16px] font-bold">Change password</h2>
        <ErrorNote>{pwError}</ErrorNote>
        <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <TextField label="Repeat new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={pwState.isLoading} disabled={!current || !next || !confirm}>
            Update password
          </Button>
        </div>
      </form>

      <section className="card p-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Sign out</p>
          <p className="text-[12px] text-muted">Kanakku web · v1.0</p>
        </div>
        <Button variant="danger" icon={<LogOut size={16} />} onClick={signOut}>
          Sign out
        </Button>
      </section>
    </div>
  )
}
