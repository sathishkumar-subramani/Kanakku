import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useCreateGroupMutation, useJoinGroupMutation, useUpdateGroupMutation } from '@/api/kanakkuApi'
import { errorMessage } from '@/api/baseQuery'
import type { Group } from '@/api/types'
import { useAppSelector } from '@/store'
import { CURRENCIES, GROUP_EMOJIS, GROUP_PALETTE } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorNote } from '@/components/ui/Bits'
import { useToast } from '@/components/ui/Toast'

export function GroupForm({ open, onClose, group }: { open: boolean; onClose: () => void; group?: Group | null }) {
  const me = useAppSelector((s) => s.auth.user)
  const navigate = useNavigate()
  const toast = useToast()
  const [create, createState] = useCreateGroupMutation()
  const [update, updateState] = useUpdateGroupMutation()

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0])
  const [color, setColor] = useState(GROUP_PALETTE[0])
  const [currency, setCurrency] = useState(me?.currency ?? 'INR')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setName(group?.name ?? '')
    setEmoji(group?.emoji ?? GROUP_EMOJIS[0])
    setColor(group?.color ?? GROUP_PALETTE[0])
    setCurrency(group?.currency ?? me?.currency ?? 'INR')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id, me?.currency])

  const saving = createState.isLoading || updateState.isLoading

  async function submit() {
    setError('')
    if (!name.trim()) return setError('Give the group a name.')
    try {
      if (group) {
        await update({ id: group.id, name: name.trim(), emoji, color }).unwrap()
        toast.success('Group updated')
        onClose()
      } else {
        const created = await create({ name: name.trim(), emoji, color, currency }).unwrap()
        toast.success(`${created.emoji} ${created.name} created`)
        onClose()
        navigate(`/groups/${created.id}?tab=members`)
      }
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? 'Edit group' : 'New group'}
      subtitle={group ? undefined : 'A room, a trip, a team — anything you share costs with.'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim()}>
            {group ? 'Save' : 'Create group'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-card flex items-center justify-center text-[28px] shrink-0" style={{ background: color + '26' }}>
            {emoji}
          </span>
          <TextField className="flex-1" label="Name" placeholder="Room 302, Goa trip…" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
        </div>
        <div>
          <span className="field-label">Icon</span>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} className={clsx('w-10 h-10 rounded-field text-[20px] border transition', emoji === e ? 'border-accent bg-accent-soft' : 'border-border bg-surface2')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="field-label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {GROUP_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={clsx('w-8 h-8 rounded-full transition ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-ink')} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
        {!group && (
          <SelectField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} hint="Can't be changed later.">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
        )}
      </div>
    </Modal>
  )
}

export function JoinGroupForm({ open, onClose, initialCode }: { open: boolean; onClose: () => void; initialCode?: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [join, state] = useJoinGroupMutation()
  const [code, setCode] = useState(initialCode ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCode(initialCode ?? '')
      setError('')
    }
  }, [open, initialCode])

  async function submit() {
    setError('')
    try {
      const g = await join({ inviteCode: code.trim().toUpperCase() }).unwrap()
      toast.success(`Welcome to ${g.emoji} ${g.name}`)
      onClose()
      navigate(`/groups/${g.id}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Join a group"
      subtitle="Ask a member for the 8-character invite code."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={state.isLoading} disabled={code.trim().length < 6}>
            Join
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <TextField label="Invite code" placeholder="E.g. 7KQ2M9XA" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="money" maxLength={12} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>
    </Modal>
  )
}
